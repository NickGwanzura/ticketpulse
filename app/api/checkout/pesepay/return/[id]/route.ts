import { NextResponse } from "next/server"
import { and, eq } from "drizzle-orm"
import { db } from "@/db"
import { orders } from "@/db/schema"
import { getPesepay, type OrderMetadata } from "@/lib/pesepay"
import { startOrderVerification } from "@/lib/order-verification"
import { notifyPaymentSuccess, notifyPaymentFailed } from "@/lib/payment-notifications"
import { log } from "@/lib/logger"

type Params = { id: string }

// Buyer lands here in the browser after completing PesePay's hosted checkout.
// We check the payment status, transition the order atomically if PesePay
// confirms, then forward the buyer to the order page. Uses the same atomic
// idempotency pattern as the webhook — only transitions if still `pending`
// so that a concurrent webhook or status poll can't race.
export async function GET(req: Request, ctx: { params: Promise<Params> }) {
  const { id } = await ctx.params
  const origin = new URL(req.url).origin

  const [order] = await db.select().from(orders).where(eq(orders.id, id)).limit(1)
  if (!order) {
    return NextResponse.redirect(`${origin}/checkout?error=not_found`)
  }

  if (order.status !== "pending") {
    return NextResponse.redirect(`${origin}/orders/${id}?awaiting=1`)
  }

  const meta = (order.metadata ?? {}) as OrderMetadata
  const pollUrl = meta.pesepay?.pollUrl
  const reference = meta.pesepay?.reference ?? order.paymentRef ?? undefined

  if (!pollUrl && !reference) {
    return NextResponse.redirect(`${origin}/orders/${id}?awaiting=1`)
  }

  const pesepay = getPesepay()
  const result = pollUrl
    ? await pesepay.pollTransaction(pollUrl)
    : await pesepay.checkPayment(reference!)

  if (result.success && result.paid && order.guestEmail) {
    // Atomic idempotency gate — only transitions if still `pending`
    const [claimed] = await db
      .update(orders)
      .set({
        status: "awaiting_verification",
        paidAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(orders.id, id), eq(orders.status, "pending")))
      .returning({ id: orders.id })

    if (claimed) {
      await startOrderVerification({
        orderId: id,
        email: order.guestEmail,
        origin,
      })
      notifyPaymentSuccess(id)
    }
  } else if (result.success && !result.paid) {
    await db
      .update(orders)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(eq(orders.id, id))
    notifyPaymentFailed(id, result.message ?? "Payment was not completed")
    return NextResponse.redirect(`${origin}/orders/${id}?error=payment_failed`)
  }

  return NextResponse.redirect(`${origin}/orders/${id}?awaiting=1`)
}
