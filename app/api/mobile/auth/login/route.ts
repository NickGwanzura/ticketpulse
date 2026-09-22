import { NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/db"
import { users } from "@/db/schema"
import { eq } from "drizzle-orm"
import { verifyPassword } from "@/lib/password"
import { createTokenPair } from "@/lib/mobile-auth"
import { authLimiter } from "@/lib/rate-limit"

const LoginSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(1).max(512),
})

export async function POST(request: Request) {
  // Rate limit
  const rl = await authLimiter.checkRequest(request)
  if (!rl.allowed) {
    return NextResponse.json(
      { ok: false, error: "Too many login attempts. Try again shortly." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } },
    )
  }

  const body = await request.json().catch(() => null)
  const parsed = LoginSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Invalid email or password format" },
      { status: 400 },
    )
  }

  const { email, password } = parsed.data
  const normalizedEmail = email.toLowerCase().trim()

  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      image: users.image,
      passwordHash: users.passwordHash,
    })
    .from(users)
    .where(eq(users.email, normalizedEmail))
    .limit(1)

  if (!user || !user.passwordHash) {
    return NextResponse.json(
      { ok: false, error: "Invalid email or password" },
      { status: 401 },
    )
  }

  if (!verifyPassword(password, user.passwordHash)) {
    return NextResponse.json(
      { ok: false, error: "Invalid email or password" },
      { status: 401 },
    )
  }

  const tokenPair = await createTokenPair({
    id: user.id,
    role: user.role ?? "attendee",
    email: user.email ?? "",
    name: user.name ?? user.email ?? "",
  })

  return NextResponse.json({
    ok: true,
    ...tokenPair,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role ?? "attendee",
      image: user.image,
    },
  })
}
