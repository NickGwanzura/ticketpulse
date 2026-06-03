import { NextResponse } from "next/server"
import { z } from "zod"
import { eq } from "drizzle-orm"
import { db } from "@/db"
import { users, passwordResetTokens } from "@/db/schema"
import { generateResetToken } from "@/lib/password-reset"
import { sendPasswordResetEmail } from "@/lib/email"
import { authLimiter } from "@/lib/rate-limit"

// Security invariant: respond identically whether or not the email maps to a
// user. Same status, same body, same approximate latency — leaking account
// existence here defeats the rest of the auth flow.
const Body = z.object({
  email: z.string().email().toLowerCase().trim(),
})

const TOKEN_TTL_MS = 60 * 60 * 1000
const RESPONSE_FLOOR_MS = 600

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? "https://ticketplse.tech"

export async function POST(req: Request) {
  // Rate limit: 5 requests per minute per IP
  const rl = authLimiter.checkRequest(req)
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many requests" }, {
      status: 429,
      headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) },
    })
  }

  const start = Date.now()
  const ok = () => NextResponse.json({ ok: true })
  const floor = async () => {
    const elapsed = Date.now() - start
    if (elapsed < RESPONSE_FLOOR_MS) {
      await new Promise((r) => setTimeout(r, RESPONSE_FLOOR_MS - elapsed))
    }
  }

  let parsed: z.infer<typeof Body>
  try {
    parsed = Body.parse(await req.json())
  } catch {
    await floor()
    return ok()
  }

  if (!process.env.DATABASE_URL) {
    await floor()
    return ok()
  }

  try {
    const [user] = await db
      .select({ id: users.id, name: users.name })
      .from(users)
      .where(eq(users.email, parsed.email))
      .limit(1)

    if (user) {
      const { raw, hash } = generateResetToken()
      const expiresAt = new Date(Date.now() + TOKEN_TTL_MS)

      await db.insert(passwordResetTokens).values({
        userId: user.id,
        tokenHash: hash,
        expiresAt,
      })

      const resetUrl = `${APP_URL}/auth/reset?token=${raw}`

      await sendPasswordResetEmail({
        to: parsed.email,
        name: user.name,
        resetUrl,
      }).catch((e) => console.error("password reset email", e))
    }
  } catch (e) {
    console.error("forgot-password", e)
  }

  await floor()
  return ok()
}
