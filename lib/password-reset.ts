import { createHash, randomBytes } from "crypto"

const TOKEN_BYTES = 32

export function generateResetToken(): { raw: string; hash: string } {
  const raw = randomBytes(TOKEN_BYTES).toString("base64url")
  return { raw, hash: hashResetToken(raw) }
}

export function hashResetToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex")
}
