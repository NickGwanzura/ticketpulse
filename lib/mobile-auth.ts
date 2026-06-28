import "server-only"

import { SignJWT, jwtVerify, type JWTPayload } from "jose"
import { db } from "@/db"
import { users } from "@/db/schema"
import { eq } from "drizzle-orm"

// ─── Env helpers ────────────────────────────────────────────────────────────────────────

const JWT_SECRET = new TextEncoder().encode(
  process.env.MOBILE_JWT_SECRET ?? process.env.AUTH_SECRET ?? "fallback-dev-secret-change-in-prod",
)

const ACCESS_TOKEN_TTL = 15 * 60 // 15 minutes
const REFRESH_TOKEN_TTL = 30 * 24 * 60 * 60 // 30 days

// ─── Types ──────────────────────────────────────────────────────────────────────────────

export interface MobileTokenPayload {
  sub: string
  role: string
  email: string
  name: string | null
}

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
    .sign(JWT_SECRET)
}

export async function createRefreshToken(payload: Pick<MobileTokenPayload, "sub">): Promise<string> {
  return await new SignJWT({ type: "refresh" } as unknown as JWTPayload)
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${REFRESH_TOKEN_TTL}s`)
    .sign(JWT_SECRET)
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
  return { accessToken, refreshToken }
}

// ─── Token verification ─────────────────────────────────────────────────────────────────

export async function verifyAccessToken(token: string): Promise<MobileTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET, {
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

export async function verifyRefreshToken(token: string): Promise<{ sub: string } | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET, {
      algorithms: ["HS256"],
    })
    if (!payload.sub) return null
    return { sub: payload.sub as string }
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

  // Re-fetch user from DB to get current role/name
  const [user] = await db
    .select({ id: users.id, role: users.role, email: users.email, name: users.name })
    .from(users)
    .where(eq(users.id, payload.sub))
    .limit(1)

  if (!user) return null

  return createTokenPair({
    id: user.id,
    role: user.role ?? "attendee",
    email: user.email ?? "",
    name: user.name ?? null,
  })
}
