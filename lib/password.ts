import { randomBytes, scryptSync, timingSafeEqual } from "crypto"

const KEYLEN = 64
const N = 2 ** 17 // scrypt cost — OWASP recommended (must be a power of 2)
const R = 8
const P = 1
// scrypt memory ≈ 128 * N * r bytes; at N=2^17, r=8 that's ~128 MiB.
// Node's default maxmem is 32 MiB, so we must raise it or scryptSync throws.
const MAXMEM = 256 * 1024 * 1024

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex")
  const derived = scryptSync(password, salt, KEYLEN, { N, r: R, p: P, maxmem: MAXMEM }).toString("hex")
  return `scrypt$${N}$${salt}$${derived}`
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, costStr, salt, expectedHex] = stored.split("$")
  if (scheme !== "scrypt" || !salt || !expectedHex) return false
  const cost = parseInt(costStr, 10)
  if (!Number.isFinite(cost)) return false
  const expected = Buffer.from(expectedHex, "hex")
  const actual = scryptSync(password, salt, expected.length, { N: cost, r: R, p: P, maxmem: MAXMEM })
  if (expected.length !== actual.length) return false
  return timingSafeEqual(expected, actual)
}
