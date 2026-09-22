import { NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/db"
import { users } from "@/db/schema"
import { eq } from "drizzle-orm"
import { hashPassword } from "@/lib/password"
import { createTokenPair } from "@/lib/mobile-auth"
import { authLimiter } from "@/lib/rate-limit"

const RegisterSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(128),
  name: z.string().min(1).max(255).optional(),
})

export async function POST(request: Request) {
  const rl = await authLimiter.checkRequest(request)
  if (!rl.allowed) {
    return NextResponse.json(
      { ok: false, error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } },
    )
  }

  const body = await request.json().catch(() => null)
  const parsed = RegisterSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Invalid registration data. Password must be at least 8 characters." },
      { status: 400 },
    )
  }

  const { email, password, name } = parsed.data
  const normalizedEmail = email.toLowerCase().trim()

  // Check for existing user
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, normalizedEmail))
    .limit(1)

  if (existing) {
    return NextResponse.json(
      { ok: false, error: "An account with this email already exists" },
      { status: 409 },
    )
  }

  const passwordHash = hashPassword(password)
  const displayName = name ?? normalizedEmail.split("@")[0]

  const [newUser] = await db
    .insert(users)
    .values({
      email: normalizedEmail,
      name: displayName,
      passwordHash,
      role: "attendee",
    })
    .returning({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      image: users.image,
    })

  const tokenPair = await createTokenPair({
    id: newUser.id,
    role: newUser.role ?? "attendee",
    email: newUser.email ?? "",
    name: newUser.name ?? newUser.email ?? "",
  })

  return NextResponse.json(
    {
      ok: true,
      ...tokenPair,
      user: {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        role: newUser.role ?? "attendee",
        image: newUser.image,
      },
    },
    { status: 201 },
  )
}
