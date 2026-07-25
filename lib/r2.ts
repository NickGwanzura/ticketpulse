import "server-only"

import { S3Client, PutObjectCommand, DeleteObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import { randomUUID } from "node:crypto"
import { log } from "@/lib/logger"

export {
  UPLOAD_LIMITS,
  ALLOWED_IMAGE_MIME,
  type UploadKind,
  type AllowedMime,
} from "./upload-limits"

// ─── Env-derived values ──────────────────────────────────────────────────────
// Re-exported so callers don't sprinkle `process.env.*` everywhere. These can
// be empty strings during `next build` without prod env — runtime presign
// calls throw a clean error if either is missing.
export const R2_BUCKET_NAME = process.env.R2_BUCKET ?? ""

// NOTE on `R2_PUBLIC_BASE`: it's `NEXT_PUBLIC_*` so it's safe in client too,
// but we keep it server-only here to avoid the lint trap of importing this
// module from a client bundle. Client code that needs the base URL can read
// `process.env.NEXT_PUBLIC_R2_PUBLIC_URL` directly — but for current callers
// the API returns a fully-formed `publicUrl` so client code never needs it.
export const R2_PUBLIC_BASE = (process.env.NEXT_PUBLIC_R2_PUBLIC_URL ?? "").replace(/\/+$/, "")

// ─── S3 client (lazy) ────────────────────────────────────────────────────────
// Built lazily so importing this module doesn't crash if env is empty (e.g.
// during a `next build` that runs without prod secrets). Cached after first
// successful build.

let _client: S3Client | null = null

function getClient(): S3Client {
  if (_client) return _client
  const endpoint = process.env.R2_ENDPOINT
  const accessKeyId = process.env.R2_ACCESS_KEY_ID
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY
  if (!endpoint || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "R2 is not configured. Set R2_ENDPOINT, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY in your environment.",
    )
  }
  _client = new S3Client({
    region: "auto",
    endpoint,
    forcePathStyle: false,
    credentials: { accessKeyId, secretAccessKey },
  })
  return _client
}

/**
 * Proxy that defers `S3Client` construction until first method access. Lets
 * code do `import { r2 } from "@/lib/r2"` without crashing at import time.
 */
export const r2: S3Client = new Proxy({} as S3Client, {
  get(_t, prop, receiver) {
    const client = getClient()
    const value = Reflect.get(client, prop, receiver)
    return typeof value === "function" ? value.bind(client) : value
  },
})

// ─── MIME / extension helpers ────────────────────────────────────────────────

const MIME_TO_EXT: Record<string, "jpg" | "png" | "webp" | "avif"> = {
  "image/jpeg": "jpg",
  "image/png":  "png",
  "image/webp": "webp",
  "image/avif": "avif",
}

export function extensionForMime(mime: string): "jpg" | "png" | "webp" | "avif" {
  const ext = MIME_TO_EXT[mime]
  if (!ext) throw new Error(`Unsupported MIME type: ${mime}`)
  return ext
}

/**
 * Build a sharded R2 key like `${prefix}/${YYYY-MM}/${uuid}.${ext}`.
 * Note: the `/api/uploads/sign` route uses a flatter `${prefix}/${uuid}.${ext}`
 * scheme directly; this helper is provided for callers that want monthly shards.
 */
export function buildKey({ prefix, ext }: { prefix: string; ext: string }): string {
  const now = new Date()
  const yyyy = now.getUTCFullYear()
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0")
  const cleanPrefix = prefix.replace(/^\/+|\/+$/g, "")
  return `${cleanPrefix}/${yyyy}-${mm}/${randomUUID()}.${ext}`
}

// ─── Presign ─────────────────────────────────────────────────────────────────

export type PresignArgs = {
  key: string
  contentType: string
  contentLength: number
  expiresIn?: number
}

export type PresignResult = {
  uploadUrl: string
  publicUrl: string
}

/**
 * Generate a presigned `PUT` URL for direct browser uploads to R2.
 * Throws if R2_BUCKET or NEXT_PUBLIC_R2_PUBLIC_URL is not configured.
 */
export async function presignUpload({
  key,
  contentType,
  contentLength,
  expiresIn = 60,
}: PresignArgs): Promise<PresignResult> {
  if (!R2_BUCKET_NAME) {
    throw new Error("R2_BUCKET is not configured.")
  }
  if (!R2_PUBLIC_BASE) {
    throw new Error("NEXT_PUBLIC_R2_PUBLIC_URL is not configured.")
  }

  const command = new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
    ContentType: contentType,
    ContentLength: contentLength,
  })

  const uploadUrl = await getSignedUrl(r2, command, { expiresIn })
  const publicUrl = `${R2_PUBLIC_BASE}/${key}`
  return { uploadUrl, publicUrl }
}

/**
 * Re-verify an uploaded object's actual size server-side after the client's
 * direct PUT completes. The presigned PUT includes ContentLength, but that's
 * a client-declared value — this closes the gap by checking what R2 actually
 * received before the app treats the upload as accepted. Deletes and rejects
 * anything over the limit rather than trusting the client's number twice.
 */
export async function verifyUploadedObjectSize(
  key: string,
  maxBytes: number,
): Promise<{ ok: boolean; actualBytes?: number }> {
  if (!R2_BUCKET_NAME) return { ok: false }
  try {
    const head = await r2.send(new HeadObjectCommand({ Bucket: R2_BUCKET_NAME, Key: key }))
    const actualBytes = head.ContentLength ?? 0
    if (actualBytes > maxBytes) {
      await r2.send(new DeleteObjectCommand({ Bucket: R2_BUCKET_NAME, Key: key })).catch(() => {})
      log.warn("r2 — uploaded object exceeded declared size cap, deleted", { key, actualBytes, maxBytes })
      return { ok: false, actualBytes }
    }
    return { ok: true, actualBytes }
  } catch (err) {
    log.error("r2 — verifyUploadedObjectSize failed", { key, error: err instanceof Error ? err.message : String(err) })
    return { ok: false }
  }
}

/**
 * Recover the R2 object key from a stored public URL. Returns null if the URL
 * doesn't live under `R2_PUBLIC_BASE` (caller should ignore — not our object).
 */
export function keyFromPublicUrl(url: string): string | null {
  if (!R2_PUBLIC_BASE) return null
  const prefix = `${R2_PUBLIC_BASE}/`
  if (!url.startsWith(prefix)) return null
  return url.slice(prefix.length)
}

/**
 * Best-effort delete of an R2 object by its stored public URL. Swallows
 * errors and returns `{ ok: false }` so callers can proceed with row deletion
 * even if the object cleanup fails — the row is the source of truth.
 */
export async function deleteByPublicUrl(url: string): Promise<{ ok: boolean }> {
  if (!R2_BUCKET_NAME) return { ok: false }
  const key = keyFromPublicUrl(url)
  if (!key) return { ok: false }
  try {
    await r2.send(new DeleteObjectCommand({ Bucket: R2_BUCKET_NAME, Key: key }))
    return { ok: true }
  } catch (err) {
    console.error("[r2] deleteByPublicUrl failed", { key, err })
    log.error("r2 — deleteByPublicUrl failed", { key, error: err instanceof Error ? err.message : String(err) })
    return { ok: false }
  }
}
