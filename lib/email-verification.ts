import { createHash, randomBytes } from "crypto"

const TOKEN_BYTES = 32
export const VERIFICATION_TOKEN_EXPIRY_HOURS = 48

export function generateVerificationToken(): { raw: string; hash: string } {
  const raw = randomBytes(TOKEN_BYTES).toString("base64url")
  return { raw, hash: hashVerificationToken(raw) }
}

export function hashVerificationToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex")
}
