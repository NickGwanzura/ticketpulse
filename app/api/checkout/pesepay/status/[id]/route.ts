import { NextResponse } from "next/server"
import { eq } from "drizzle-orm"
import { db } from "@/db"
import { orders } from "@/db/schema"
import { getPesepay } from "@/lib/pesepay"
import { startOrderVerification } from "@/lib/order-verification"

type Params = { id: string }

type OrderMetadata = {
  pesepay?: { pollUrl?: string; reference?: string }
}

// Polled by the checkout page while the buyer is completing payment on their
// phone. Each call hits PesePay, then transitions the order on SUCCESS /
// FAILURE. The transition is guarded so duplicate calls don't re-fire the
// verification email.
export async function GET(_req: Request, ctx: { params: Promise<Params> }) {
  const { id } = await ctx.params

  const [order] = await db.select().from(orders).where(eq(orders.id, id)).limit(1)
  if (!order) return NextResponse.json({ error: "not_found" }, { status: 404 })

  // Already past the gate — nothing to poll, just report current state.
  if (order.status !== "pending") {
    return NextResponse.json({
      orderId: id,
      status: order.status,
      paid: order.status === "awaiting_verification" || order.status === "paid",
      sentTo: order.guestEmail,
    })
  }

  const meta = (order.metadata ?? {}) as OrderMetadata
  const pollUrl = meta.pesepay?.pollUrl
  const reference = meta.pesepay?.reference ?? order.paymentRef ?? undefined
  if (!pollUrl && !reference) {
    return NextResponse.json({ error: "missing_pesepay_reference" }, { status: 400 })
  }

  const pesepay = getPesepay()
  const result = pollUrl
    ? await pesepay.pollTransaction(pollUrl)
    : await pesepay.checkPayment(reference!)

  if (!result.success) {
    return NextResponse.json({
      orderId: id,
      status: "pending",
      paid: false,
      message: result.message,
    })
  }

  if (result.paid) {
    const email = order.guestEmail
    if (!email) {
      return NextResponse.json({ error: "order_missing_email" }, { status: 500 })
    }
    const origin = new URL(_req.url).origin
    await startOrderVerification({ orderId: id, email, origin })
    return NextResponse.json({
      orderId: id,
      status: "awaiting_verification",
      paid: true,
      sentTo: email,
    })
  }

  return NextResponse.json({ orderId: id, status: "pending", paid: false })
}
