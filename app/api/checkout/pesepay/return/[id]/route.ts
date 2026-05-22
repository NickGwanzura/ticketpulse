import { NextResponse } from "next/server"
import { eq } from "drizzle-orm"
import { db } from "@/db"
import { orders } from "@/db/schema"
import { getPesepay, type OrderMetadata } from "@/lib/pesepay"
import { startOrderVerification } from "@/lib/order-verification"
import { log } from "@/lib/logger"

type Params = { id: string }

// Buyer lands here in the browser after completing PesePay's hosted checkout.
// We check the payment status, transition the order if PesePay confirms, then
// forward the buyer to the order page where they'll see the verify-email
// prompt (or an error state on failure).
export async function GET(req: Request, ctx: { params: Promise<Params> }) {
  const { id } = await ctx.params
  const origin = new URL(req.url).origin

  const [order] = await db.select().from(orders).where(eq(orders.id, id)).limit(1)
  if (!order) {
    return NextResponse.redirect(`${origin}/checkout?error=not_found`)
  }

  if (order.status === "pending") {
    const meta = (order.metadata ?? {}) as OrderMetadata
    const pollUrl = meta.pesepay?.pollUrl
    const reference = meta.pesepay?.reference ?? order.paymentRef ?? undefined

    if (pollUrl || reference) {
      const pesepay = getPesepay()
      const result = pollUrl
        ? await pesepay.pollTransaction(pollUrl)
        : await pesepay.checkPayment(reference!)

      if (result.success && result.paid && order.guestEmail) {
        // Mark paidAt before starting verification
        await db
          .update(orders)
          .set({ paidAt: new Date(), updatedAt: new Date() })
          .where(eq(orders.id, id))

        await startOrderVerification({
          orderId: id,
          email: order.guestEmail,
          origin,
        })
      } else if (result.success && !result.paid) {
        // PesePay was reachable but the transaction didn't succeed — flip the
        // order to cancelled so the buyer can retry without seeing stale state.
        await db
          .update(orders)
          .set({ status: "cancelled", updatedAt: new Date() })
          .where(eq(orders.id, id))
        return NextResponse.redirect(`${origin}/orders/${id}?error=payment_failed`)
      }
    }
  }

  return NextResponse.redirect(`${origin}/orders/${id}?awaiting=1`)
}
