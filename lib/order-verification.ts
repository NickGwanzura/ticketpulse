import "server-only"
import { eq } from "drizzle-orm"
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
// If the email fails to send, the order status is reverted to `pending` so the
// caller can retry without leaving the order in an inconsistent state.
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
    // Email sending failed — revert the order status so it can be re-processed
    log.error("order-verification — email send failed, reverting status", {
      orderId: opts.orderId,
      error: err instanceof Error ? err.message : String(err),
    })
    await db
      .update(orders)
      .set({ status: "pending", updatedAt: new Date() })
      .where(eq(orders.id, opts.orderId))
    throw err
  }

  return { expiresAt }
}
