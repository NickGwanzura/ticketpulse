import { NextRequest, NextResponse } from "next/server"
import { randomUUID } from "node:crypto"
import { eq } from "drizzle-orm"
import { z } from "zod"

import { auth } from "@/auth"
import { db } from "@/db"
import { vendors, events } from "@/db/schema"
import {
  presignUpload,
  extensionForMime,
  R2_BUCKET_NAME,
  R2_PUBLIC_BASE,
} from "@/lib/r2"
import {
  UPLOAD_LIMITS,
  ALLOWED_IMAGE_MIME,
  type UploadKind,
} from "@/lib/upload-limits"

export const runtime = "nodejs"

const KIND_VALUES = [
  "avatar",
  "vendor-logo",
  "vendor-portfolio",
  "event-cover",
  "event-gallery",
  "merch",
] as const satisfies readonly UploadKind[]

const Body = z.object({
  kind:          z.enum(KIND_VALUES),
  filename:      z.string().min(1).max(200),
  contentType:   z.enum(ALLOWED_IMAGE_MIME),
  contentLength: z.number().int().positive(),
  vendorId:      z.uuid().optional(),
  eventId:       z.uuid().optional(),
})

function bad(message: string, status: number, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: message, ...extra }, { status })
}

export async function POST(req: NextRequest) {
  // Auth
  const session = await auth()
  if (!session?.user?.id) {
    return bad("Unauthorized", 401)
  }
  const userId = session.user.id
  const isAdmin = session.user.role === "admin"

  // Misconfig — fail fast with 500 before any DB work
  if (!R2_BUCKET_NAME || !R2_PUBLIC_BASE) {
    return bad("Upload service not configured", 500)
  }

  // Parse body
  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return bad("Invalid JSON", 400)
  }
  const parsed = Body.safeParse(raw)
  if (!parsed.success) {
    return bad("Invalid input", 400, { issues: parsed.error.issues })
  }
  const { kind, contentType, contentLength, vendorId, eventId } = parsed.data

  // Defensive MIME check (Zod handles this via enum, but belt-and-braces)
  if (!(ALLOWED_IMAGE_MIME as readonly string[]).includes(contentType)) {
    return bad("Unsupported content type", 400)
  }

  // Size cap
  const limit = UPLOAD_LIMITS[kind]
  if (contentLength > limit) {
    return bad(`File too large. Max ${limit} bytes for ${kind}.`, 413, { maxBytes: limit })
  }

  // ── Authorization & key prefix per kind ────────────────────────────────────
  let prefix: string

  switch (kind) {
    case "avatar": {
      prefix = `avatars/${userId}`
      break
    }

    case "vendor-logo":
    case "vendor-portfolio": {
      if (!vendorId) return bad("vendorId is required for vendor uploads", 400)
      const [vendor] = await db
        .select({ id: vendors.id, userId: vendors.userId })
        .from(vendors)
        .where(eq(vendors.id, vendorId))
        .limit(1)
      if (!vendor) return bad("Vendor not found", 404)
      if (vendor.userId !== userId && !isAdmin) return bad("Forbidden", 403)
      prefix = kind === "vendor-logo"
        ? `vendors/${vendorId}/logo`
        : `vendors/${vendorId}/portfolio`
      break
    }

    case "event-cover":
    case "event-gallery":
    case "merch": {
      if (!eventId) return bad("eventId is required for event uploads", 400)
      const [event] = await db
        .select({ id: events.id, organizerId: events.organizerId })
        .from(events)
        .where(eq(events.id, eventId))
        .limit(1)
      if (!event) return bad("Event not found", 404)
      if (event.organizerId !== userId && !isAdmin) return bad("Forbidden", 403)
      prefix = kind === "event-cover"
        ? `events/${eventId}/cover`
        : kind === "event-gallery"
          ? `events/${eventId}/gallery`
          : `events/${eventId}/merch`
      break
    }
  }

  // Build flat key: ${prefix}/${uuid}.${ext}
  const ext = extensionForMime(contentType)
  const key = `${prefix}/${randomUUID()}.${ext}`

  try {
    const { uploadUrl, publicUrl } = await presignUpload({
      key,
      contentType,
      contentLength,
    })
    return NextResponse.json({ uploadUrl, publicUrl, key })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to presign upload"
    return bad(message, 500)
  }
}
