import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import { auth } from "@/auth"
import { verifyUploadedObjectSize } from "@/lib/r2"
import { UPLOAD_LIMITS, type UploadKind } from "@/lib/upload-limits"
import { uploadLimiter } from "@/lib/rate-limit"

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

const Body = z.object({
  key: z.string().min(1).max(500),
  kind: z.enum(KIND_VALUES),
})

/**
 * Called by the client immediately after a direct-to-R2 PUT completes.
 * Re-checks the object's actual size against the same cap enforced at
 * presign time — the presign step only had the client's *declared*
 * Content-Length to go on, this confirms what R2 actually received.
 */
export async function POST(req: NextRequest) {
  const rl = await uploadLimiter.checkRequest(req)
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many requests" }, {
      status: 429,
      headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) },
    })
  }

  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }
  const parsed = Body.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 })
  }

  const { key, kind } = parsed.data
  const maxBytes = UPLOAD_LIMITS[kind]
  const result = await verifyUploadedObjectSize(key, maxBytes)

  if (!result.ok) {
    return NextResponse.json(
      { error: "Uploaded file exceeded the allowed size and was removed.", maxBytes, actualBytes: result.actualBytes },
      { status: 413 },
    )
  }

  return NextResponse.json({ ok: true })
}
