import { NextResponse } from "next/server"
import { eq } from "drizzle-orm"

import { auth } from "@/auth"
import { db } from "@/db"
import { emailVerificationTokens, users } from "@/db/schema"
import { hashVerificationToken, VERIFICATION_TOKEN_EXPIRY_HOURS } from "@/lib/email-verification"
import { trackOrganizerLifecycle } from "@/lib/organizer-lifecycle"

/**
 * GET /api/auth/verify-email/[token]
 *
 * Validates the raw verification token, marks the user's email as verified,
 * and redirects to the organizer dashboard.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params
  const tokenHash = hashVerificationToken(token)

  const [row] = await db
    .select({
      id: emailVerificationTokens.id,
      userId: emailVerificationTokens.userId,
      expiresAt: emailVerificationTokens.expiresAt,
      usedAt: emailVerificationTokens.usedAt,
    })
    .from(emailVerificationTokens)
    .where(eq(emailVerificationTokens.tokenHash, tokenHash))
    .limit(1)

  if (!row) {
    return new Response("Invalid verification link.", { status: 404 })
  }

  if (row.usedAt) {
    return new Response("This verification link has already been used. You can sign in and try again.", { status: 410 })
  }

  if (new Date() > row.expiresAt) {
    return new Response(
      `This verification link has expired (links expire after ${VERIFICATION_TOKEN_EXPIRY_HOURS}h). Sign in to request a new one.`,
      { status: 410 },
    )
  }

  // Mark email as verified and consume the token in a transaction
  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({ emailVerified: new Date(), updatedAt: new Date() })
      .where(eq(users.id, row.userId))

    await tx
      .update(emailVerificationTokens)
      .set({ usedAt: new Date() })
      .where(eq(emailVerificationTokens.id, row.id))
  })

  await trackOrganizerLifecycle({
    step: "EMAIL_VERIFIED",
    organizerId: row.userId,
    dedupeKey: `organizer:${row.userId}:email-verified`,
    source: "email_verification",
  })

  // Redirect to organizer dashboard with success flag
  const session = await auth()
  const dashboardUrl = session?.user?.id ? "/organizer?verified=1" : "/auth/signin?verified=1"
  return NextResponse.redirect(new URL(dashboardUrl, _req.url))
}
