import "server-only"
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto"

const TTL_MS = 15 * 60_000
function key() {
  const secret = process.env.AUTH_SECRET ?? process.env.TICKET_QR_SECRET
  if (!secret) throw new Error("Order recovery requires AUTH_SECRET or TICKET_QR_SECRET")
  return secret
}
function signature(payload: string) {
  return createHmac("sha256", key()).update(`order-recovery:v1:${payload}`).digest("base64url")
}
export function createOrderRecoveryToken(email: string, now = Date.now()): string {
  const payload = Buffer.from(JSON.stringify({ email: email.trim().toLowerCase(), expires: now + TTL_MS, nonce: randomBytes(16).toString("hex") })).toString("base64url")
  return `${payload}.${signature(payload)}`
}
export function verifyOrderRecoveryToken(token: string | undefined | null, now = Date.now()): string | null {
  if (!token || token.length > 2000) return null
  try {
    const [payload, supplied, extra] = token.split(".")
    if (!payload || !supplied || extra) return null
    const a = Buffer.from(supplied), b = Buffer.from(signature(payload))
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null
    const data = JSON.parse(Buffer.from(payload, "base64url").toString())
    return typeof data.email === "string" && typeof data.expires === "number" && data.expires > now && data.expires <= now + TTL_MS
      ? data.email : null
  } catch { return null }
}
