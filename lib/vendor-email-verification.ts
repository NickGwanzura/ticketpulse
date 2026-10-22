import "server-only"

import { eq } from "drizzle-orm"
import { db } from "@/db"
import { emailVerificationTokens, users } from "@/db/schema"
import { generateVerificationToken, VERIFICATION_TOKEN_EXPIRY_HOURS } from "@/lib/email-verification"
import { sendEmailVerificationEmail } from "@/lib/email"
import { rateLimit } from "@/lib/rate-limit"

const verificationLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 3 })

export async function sendVendorEmailVerification(userId: string): Promise<"sent" | "verified" | "limited" | "missing"> {
  const [user] = await db.select({ email: users.email, name: users.name, emailVerified: users.emailVerified })
    .from(users).where(eq(users.id, userId)).limit(1)
  if (!user?.email) return "missing"
  if (user.emailVerified) return "verified"

  const limit = await verificationLimiter.checkDistributed(`vendor-email:${userId}`)
  if (!limit.allowed) return "limited"

  const token = generateVerificationToken()
  await db.insert(emailVerificationTokens).values({
    userId,
    tokenHash: token.hash,
    expiresAt: new Date(Date.now() + VERIFICATION_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000),
  })
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://ticketpulse.tech"
  await sendEmailVerificationEmail({
    to: user.email,
    name: user.name,
    url: `${appUrl}/api/auth/verify-email/${token.raw}`,
    purpose: "vendor",
  })
  return "sent"
}
