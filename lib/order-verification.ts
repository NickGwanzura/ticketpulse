import "server-only"
import { eq, sql } from "drizzle-orm"
import { db } from "@/db"
import { orders } from "@/db/schema"
import { signIn } from "@/auth"
import { log } from "@/lib/logger"

const VERIFICATION_TTL_HOURS = 24

// Flips an order to `awaiting_verification` and fires the NextAuth magic-link
// email so the buyer can claim the order against their account. Used by the
// offline (pay-at-venue) path on order creation and by the Velocity status /
// routes once payment is confirmed. Safe to call once per order — the caller
// should guard against duplicates.
//
// IMPORTANT: If the email fails to send, the order REMAINS at
// `awaiting_verification`. The payment has already been confirmed in Velocity
// and the workflow finalized — reverting to `pending` would orphan a valid
// payment. Instead, a `verificationError` is stored in metadata so admins can
// see the issue and resend the verification email manually.
export async function startOrderVerification(opts: {
  orderId: string
  email: string
  origin: string
}): Promise<{ expiresAt: Date }> {
  const expiresAt = new Date(Date.now() + VERIFICATION_TTL_HOURS * 60 * 60 * 1000)

  await db
    .update(orders)
    .set({
      status: "awaiting_verification",
      verificationSentAt: new Date(),
      verificationExpires: expiresAt,
      updatedAt: new Date(),
    })
    .where(eq(orders.id, opts.orderId))

  const finalizeUrl = `${opts.origin}/api/orders/${opts.orderId}/finalize`
  try {
    await signIn("resend", {
      email: opts.email,
      redirectTo: finalizeUrl,
      redirect: false,
    })
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err)
    log.error("order-verification — email send failed, order remains awaiting_verification", {
      orderId: opts.orderId,
      error: errorMessage,
    })
    // Store the error in metadata but do NOT revert status —
    // the payment was already confirmed in Velocity.
    // Admin can resend verification via the admin panel.
    await db
      .update(orders)
      .set({
        updatedAt: new Date(),
        metadata: sql`jsonb_set(COALESCE(${orders.metadata}, '{}'::jsonb), '{verificationError}', ${JSON.stringify(errorMessage)}::jsonb)`,
      })
      .where(eq(orders.id, opts.orderId))
    throw err
  }

  return { expiresAt }
}
