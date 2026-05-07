import { randomBytes, scryptSync, timingSafeEqual } from "crypto"

const KEYLEN = 64
const N = 2 ** 14 // scrypt cost — same as Node default tier

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex")
  const derived = scryptSync(password, salt, KEYLEN, { N }).toString("hex")
  return `scrypt$${N}$${salt}$${derived}`
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, costStr, salt, expectedHex] = stored.split("$")
  if (scheme !== "scrypt" || !salt || !expectedHex) return false
  const cost = parseInt(costStr, 10)
  if (!Number.isFinite(cost)) return false
  const expected = Buffer.from(expectedHex, "hex")
  const actual = scryptSync(password, salt, expected.length, { N: cost })
  if (expected.length !== actual.length) return false
  return timingSafeEqual(expected, actual)
}
