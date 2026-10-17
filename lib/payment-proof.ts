import "server-only"

import { randomUUID } from "node:crypto"
import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3"

import { r2 } from "@/lib/r2"

/**
 * Proof-of-payment files (screenshots / PDFs of EcoCash and bank receipts).
 *
 * They contain names, phone numbers and balances, so they must NOT go in the
 * public media bucket. They live in a separate, private bucket named by
 * R2_PROOF_BUCKET and are only ever read back through an admin-only route.
 * When R2_PROOF_BUCKET is not set the upload feature is simply switched off.
 */
export const PROOF_MAX_BYTES = 5 * 1024 * 1024
export const PROOF_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
}

export function proofBucket(): string {
  return process.env.R2_PROOF_BUCKET ?? ""
}

export function isProofStorageConfigured(): boolean {
  return Boolean(proofBucket() && process.env.R2_ENDPOINT && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY)
}

export function proofKeyBelongsToOrder(key: string, orderId: string): boolean {
  return key.startsWith(`proofs/${orderId}/`) && !key.includes("..")
}

export async function putProof(orderId: string, body: Buffer, mime: string): Promise<string> {
  const ext = PROOF_MIME[mime]
  if (!ext) throw new Error("Unsupported proof file type")
  const key = `proofs/${orderId}/${randomUUID()}.${ext}`
  await r2.send(new PutObjectCommand({ Bucket: proofBucket(), Key: key, Body: body, ContentType: mime }))
  return key
}

export async function getProof(key: string): Promise<{ body: Uint8Array; contentType: string } | null> {
  const res = await r2.send(new GetObjectCommand({ Bucket: proofBucket(), Key: key }))
  if (!res.Body) return null
  return { body: await res.Body.transformToByteArray(), contentType: res.ContentType ?? "application/octet-stream" }
}
