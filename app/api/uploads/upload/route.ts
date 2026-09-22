import { NextRequest, NextResponse } from "next/server"
import { randomUUID } from "node:crypto"
import { eq } from "drizzle-orm"

import { auth } from "@/auth"
import { db } from "@/db"
import { events, vendors } from "@/db/schema"
import { extensionForMime, R2_BUCKET_NAME, R2_PUBLIC_BASE, r2 } from "@/lib/r2"
import { ALLOWED_IMAGE_MIME, UPLOAD_LIMITS, type UploadKind } from "@/lib/upload-limits"
import { uploadLimiter } from "@/lib/rate-limit"
import { PutObjectCommand } from "@aws-sdk/client-s3"

export const runtime = "nodejs"

const KIND_VALUES = [
  "avatar",
  "vendor-logo",
  "vendor-portfolio",
  "event-cover",
  "event-promo",
  "event-gallery",
  "merch",
] as const satisfies readonly UploadKind[]

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status })
}

export async function POST(req: NextRequest) {
  const rl = await uploadLimiter.checkRequest(req)
  if (!rl.allowed) return errorResponse("Too many requests", 429)

  const session = await auth()
  if (!session?.user?.id) return errorResponse("Unauthorized", 401)

  if (!R2_BUCKET_NAME || !R2_PUBLIC_BASE) {
    return errorResponse("Upload service is not configured", 500)
  }

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return errorResponse("Invalid upload form", 400)
  }

  const kind = form.get("kind")?.toString() as UploadKind | undefined
  const vendorId = form.get("vendorId")?.toString() || undefined
  const eventId = form.get("eventId")?.toString() || undefined
  const file = form.get("file")

  if (!kind || !KIND_VALUES.includes(kind)) return errorResponse("Invalid upload kind", 400)
  if (!file || typeof file !== "object" || !("arrayBuffer" in file) || !("type" in file)) {
    return errorResponse("Image file is required", 400)
  }

  const contentType = String(file.type)
  if (!(ALLOWED_IMAGE_MIME as readonly string[]).includes(contentType)) {
    return errorResponse("Unsupported image type", 400)
  }

  const bytes = Buffer.from(await (file as Blob).arrayBuffer())
  const maxBytes = UPLOAD_LIMITS[kind]
  if (bytes.length === 0) return errorResponse("Image file is empty", 400)
  if (bytes.length > maxBytes) return errorResponse(`File too large. Max ${maxBytes} bytes.`, 413)

  const userId = session.user.id
  const isAdmin = session.user.role === "admin"
  let prefix: string

  if (kind === "avatar") {
    prefix = `avatars/${userId}`
  } else if (kind === "vendor-logo" || kind === "vendor-portfolio") {
    if (!vendorId) return errorResponse("vendorId is required", 400)
    const [vendor] = await db.select({ id: vendors.id, userId: vendors.userId }).from(vendors).where(eq(vendors.id, vendorId)).limit(1)
    if (!vendor) return errorResponse("Vendor not found", 404)
    if (vendor.userId !== userId && !isAdmin) return errorResponse("Forbidden", 403)
    prefix = kind === "vendor-logo" ? `vendors/${vendorId}/logo` : `vendors/${vendorId}/portfolio`
  } else {
    if (!eventId) return errorResponse("eventId is required", 400)
    const [event] = await db.select({ id: events.id, organizerId: events.organizerId }).from(events).where(eq(events.id, eventId)).limit(1)
    if (!event) return errorResponse("Event not found", 404)
    if (event.organizerId !== userId && !isAdmin) return errorResponse("Forbidden", 403)
    prefix = kind === "event-cover"
      ? `events/${eventId}/cover`
      : kind === "event-promo"
        ? `events/${eventId}/promo`
        : kind === "event-gallery"
          ? `events/${eventId}/gallery`
          : `events/${eventId}/merch`
  }

  const key = `${prefix}/${randomUUID()}.${extensionForMime(contentType)}`
  try {
    await r2.send(new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      Body: bytes,
      ContentType: contentType,
      ContentLength: bytes.length,
    }))
    return NextResponse.json({ ok: true, key, publicUrl: `${R2_PUBLIC_BASE}/${key}` })
  } catch (err) {
    console.error("[uploads/upload] R2 put failed", err)
    return errorResponse("Storage upload failed. Please retry.", 502)
  }
}
