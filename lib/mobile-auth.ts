import "server-only"

import { createHash, randomUUID } from "node:crypto"
import { SignJWT, jwtVerify, type JWTPayload } from "jose"
import { db } from "@/db"
import { mobileSessions, users } from "@/db/schema"
import { and, eq, gt, isNull } from "drizzle-orm"

// ─── Env helpers ────────────────────────────────────────────────────────────────────────

function getJwtSecret() {
  const secret = process.env.MOBILE_JWT_SECRET ?? process.env.AUTH_SECRET
  if (!secret || secret.length < 32) {
    throw new Error("MOBILE_JWT_SECRET or AUTH_SECRET must be set to at least 32 characters")
  }
  return new TextEncoder().encode(secret)
}

const ACCESS_TOKEN_TTL = 15 * 60 // 15 minutes
const REFRESH_TOKEN_TTL = 30 * 24 * 60 * 60 // 30 days

// ─── Types ──────────────────────────────────────────────────────────────────────────────

export interface MobileTokenPayload {
  sub: string
  role: string
  email: string
  name: string | null
}

const hashRefreshToken = (token: string) => createHash("sha256").update(token).digest("hex")

export interface MobileAuthResult {
  ok: true
  userId: string
  role: string
  email: string
  name: string | null
}

export interface MobileAuthError {
  ok: false
  error: string
  status: number
}

// ─── Token creation ─────────────────────────────────────────────────────────────────────

export async function createAccessToken(payload: MobileTokenPayload): Promise<string> {
  return await new SignJWT({ ...payload } as unknown as JWTPayload)
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TOKEN_TTL}s`)
    .sign(getJwtSecret())
}

export async function createRefreshToken(payload: Pick<MobileTokenPayload, "sub">): Promise<string> {
  return await new SignJWT({ type: "refresh" } as unknown as JWTPayload)
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setJti(randomUUID())
    .setIssuedAt()
    .setExpirationTime(`${REFRESH_TOKEN_TTL}s`)
    .sign(getJwtSecret())
}

export async function createTokenPair(user: {
  id: string
  role: string
  email: string
  name: string | null
}) {
  const payload: MobileTokenPayload = {
    sub: user.id,
    role: user.role,
    email: user.email,
    name: user.name,
  }
  const [accessToken, refreshToken] = await Promise.all([
    createAccessToken(payload),
    createRefreshToken(payload),
  ])
  await db.insert(mobileSessions).values({
    userId: user.id,
    refreshTokenHash: hashRefreshToken(refreshToken),
    expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL * 1000),
  })
  return { accessToken, refreshToken }
}

// ─── Token verification ─────────────────────────────────────────────────────────────────

export async function verifyAccessToken(token: string): Promise<MobileTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret(), {
      algorithms: ["HS256"],
    })
    if (!payload.sub || !payload.role || !payload.email) return null
    return {
      sub: payload.sub as string,
      role: payload.role as string,
      email: payload.email as string,
      name: (payload.name as string | null) ?? null,
    }
  } catch {
    return null
  }
}

export async function verifyRefreshToken(token: string): Promise<{ sub: string; jti: string } | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret(), {
      algorithms: ["HS256"],
    })
    if (!payload.sub || !payload.jti || payload.type !== "refresh") return null
    return { sub: payload.sub as string, jti: payload.jti as string }
  } catch {
    return null
  }
}

// ─── Request auth middleware ────────────────────────────────────────────────────────────

/**
 * Extracts and verifies the Bearer token from a request.
 * Use on all /api/mobile/* routes except login/register/refresh.
 */
export async function authenticateRequest(
  request: Request,
): Promise<MobileAuthResult | MobileAuthError> {
  const header = request.headers.get("authorization")
  if (!header || !header.startsWith("Bearer ")) {
    return { ok: false, error: "Missing or malformed authorization header", status: 401 }
  }

  const token = header.slice(7).trim()
  const payload = await verifyAccessToken(token)
  if (!payload) {
    return { ok: false, error: "Invalid or expired token", status: 401 }
  }

  return {
    ok: true,
    userId: payload.sub,
    role: payload.role,
    email: payload.email,
    name: payload.name,
  }
}

// ─── Refresh flow ───────────────────────────────────────────────────────────────────────

/**
 * Refreshes a token pair using a valid refresh token.
 * Returns null if the refresh token is invalid.
 */
export async function refreshTokens(refreshToken: string) {
  const payload = await verifyRefreshToken(refreshToken)
  if (!payload) return null

  const tokenHash = hashRefreshToken(refreshToken)
  const [session] = await db
    .select({ id: mobileSessions.id, userId: mobileSessions.userId })
    .from(mobileSessions)
    .where(and(
      eq(mobileSessions.userId, payload.sub),
      eq(mobileSessions.refreshTokenHash, tokenHash),
      isNull(mobileSessions.revokedAt),
      gt(mobileSessions.expiresAt, new Date()),
    ))
    .limit(1)
  if (!session) return null

  // Re-fetch user from DB to get current role/name
  const [user] = await db
    .select({ id: users.id, role: users.role, email: users.email, name: users.name })
    .from(users)
    .where(eq(users.id, payload.sub))
    .limit(1)

  if (!user) return null

  const nextTokens = await createTokenPair({
    id: user.id,
    role: user.role ?? "attendee",
    email: user.email ?? "",
    name: user.name ?? null,
  })
  await db.update(mobileSessions).set({ revokedAt: new Date(), lastUsedAt: new Date() }).where(eq(mobileSessions.id, session.id))
  return nextTokens
}

export async function revokeRefreshToken(refreshToken: string) {
  const payload = await verifyRefreshToken(refreshToken)
  if (!payload) return false
  const updated = await db.update(mobileSessions)
    .set({ revokedAt: new Date(), lastUsedAt: new Date() })
    .where(and(eq(mobileSessions.userId, payload.sub), eq(mobileSessions.refreshTokenHash, hashRefreshToken(refreshToken)), isNull(mobileSessions.revokedAt)))
    .returning({ id: mobileSessions.id })
  return updated.length > 0
}
