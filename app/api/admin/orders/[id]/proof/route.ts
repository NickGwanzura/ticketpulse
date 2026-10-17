import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { log } from "@/lib/logger"
import {
  getProof,
  isProofStorageConfigured,
  PROOF_MAX_BYTES,
  PROOF_MIME,
  proofKeyBelongsToOrder,
  putProof,
} from "@/lib/payment-proof"
import { uploadLimiter } from "@/lib/rate-limit"

export const runtime = "nodejs"

const json = (error: string, status: number) => NextResponse.json({ error }, { status })

async function requireAdmin() {
  const session = await auth()
  return session?.user?.id && session.user.role === "admin" ? session : null
}

/** Admin uploads a proof-of-payment file for an order. Returns its private key. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) return json("Unauthorized", 401)
  if (!isProofStorageConfigured()) return json("Proof storage is not configured (set R2_PROOF_BUCKET).", 503)
  const rl = await uploadLimiter.checkRequest(req)
  if (!rl.allowed) return json("Too many requests", 429)

  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) return json("Not found", 404)

  const form = await req.formData().catch(() => null)
  const file = form?.get("file")
  if (!file || typeof file !== "object" || !("arrayBuffer" in file)) return json("File is required", 400)
  if (!(String(file.type) in PROOF_MIME)) return json("Use a JPG, PNG, WebP or PDF file.", 400)
  if (file.size > PROOF_MAX_BYTES) return json("File is larger than 5 MB.", 413)

  try {
    const key = await putProof(id, Buffer.from(await file.arrayBuffer()), String(file.type))
    return NextResponse.json({ key })
  } catch (err) {
    log.error("proof upload failed", { orderId: id, error: String(err) })
    return json("Could not store the proof file.", 500)
  }
}

/** Admin views a stored proof: /api/admin/orders/<id>/proof?key=proofs/<id>/<file> */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) return json("Unauthorized", 401)
  if (!isProofStorageConfigured()) return json("Proof storage is not configured.", 503)

  const { id } = await params
  const key = new URL(req.url).searchParams.get("key") ?? ""
  if (!proofKeyBelongsToOrder(key, id)) return json("Not found", 404)

  try {
    const proof = await getProof(key)
    if (!proof) return json("Not found", 404)
    return new NextResponse(proof.body as BodyInit, {
      headers: {
        "Content-Type": proof.contentType,
        "Content-Disposition": "inline",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    })
  } catch {
    return json("Not found", 404)
  }
}
