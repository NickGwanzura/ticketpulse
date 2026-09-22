import { NextResponse } from "next/server"
import { z } from "zod"
import { and, eq, gt, isNull } from "drizzle-orm"
import { db } from "@/db"
import { users, passwordResetTokens } from "@/db/schema"
import { hashResetToken } from "@/lib/password-reset"
import { hashPassword } from "@/lib/password"
import { authLimiter } from "@/lib/rate-limit"

// Security invariants: tokens are single-use (usedAt gate), expiry-bounded,
// and the consume + password-update happen in one transaction so a token row
// is never burned without the password being rotated.
const Body = z.object({
  token: z.string().min(1).max(512),
  password: z.string().min(8).max(256),
})

const GENERIC_ERROR = { error: "Invalid or expired link." }

export async function POST(req: Request) {
  // Rate limit: 5 requests per minute per IP
  const rl = await authLimiter.checkRequest(req)
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many requests" }, {
      status: 429,
      headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) },
    })
  }

  let parsed: z.infer<typeof Body>
  try {
    parsed = Body.parse(await req.json())
  } catch {
    return NextResponse.json(GENERIC_ERROR, { status: 400 })
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json(GENERIC_ERROR, { status: 400 })
  }

  const tokenHash = hashResetToken(parsed.token)
  const newHash = hashPassword(parsed.password)
  const now = new Date()

  // Google-only users have passwordHash = null. Allowing this turns reset into
  // a "set password" flow for OAuth-first accounts; intentional, not a bug.
  try {
    await db.transaction(async (tx) => {
      const [claimed] = await tx
        .update(passwordResetTokens)
        .set({ usedAt: now })
        .where(
          and(
            eq(passwordResetTokens.tokenHash, tokenHash),
            isNull(passwordResetTokens.usedAt),
            gt(passwordResetTokens.expiresAt, now),
          ),
        )
        .returning({ userId: passwordResetTokens.userId })

      if (!claimed) throw new Error("invalid")

      await tx
        .update(users)
        .set({ passwordHash: newHash, updatedAt: now })
        .where(eq(users.id, claimed.userId))

      await tx
        .update(passwordResetTokens)
        .set({ usedAt: now })
        .where(
          and(
            eq(passwordResetTokens.userId, claimed.userId),
            isNull(passwordResetTokens.usedAt),
          ),
        )
    })
  } catch (e) {
    if ((e as Error).message !== "invalid") console.error("reset-password", e)
    return NextResponse.json(GENERIC_ERROR, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}
