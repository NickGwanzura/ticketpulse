import { NextResponse } from "next/server"
import { and, eq } from "drizzle-orm"
import { db } from "@/db"
import { orders } from "@/db/schema"
import { pollVelocityTransaction, completeVelocitySalesOrder } from "@/lib/velocity"
import { startOrderVerification } from "@/lib/order-verification"
import { log } from "@/lib/logger"

type Params = { id: string }

export async function GET(_req: Request, ctx: { params: Promise<Params> }) {
  const { id } = await ctx.params

  const [order] = await db.select().from(orders).where(eq(orders.id, id)).limit(1)
  if (!order) return NextResponse.json({ error: "not_found" }, { status: 404 })

  if (order.status !== "pending") {
    return NextResponse.json({
      orderId: id,
      status: order.status,
      paid: order.status === "awaiting_verification" || order.status === "paid",
      sentTo: order.guestEmail,
    })
  }

  const meta = (order.metadata ?? {}) as { velocity?: { salesOrderTrace: string; transactionTrace: string; workflowId: string } }
  const txTrace = meta.velocity?.transactionTrace
  if (!txTrace) {
    return NextResponse.json({ error: "missing_velocity_trace" }, { status: 400 })
  }

  let poll: Awaited<ReturnType<typeof pollVelocityTransaction>>
  try {
    poll = await pollVelocityTransaction(txTrace)
  } catch (err) {
    log.warn("velocity status — poll failed", { orderId: id, trace: txTrace, error: String(err) })
    return NextResponse.json({ orderId: id, status: "pending", paid: false, message: String(err) })
  }

  if (poll.pollStatus === "SUCCESS") {
    const [claimed] = await db
      .update(orders)
      .set({ status: "awaiting_verification", paidAt: new Date(), updatedAt: new Date() })
      .where(and(eq(orders.id, id), eq(orders.status, "pending")))
      .returning({ id: orders.id })

    if (!claimed) {
      return NextResponse.json({
        orderId: id,
        status: "awaiting_verification",
        paid: true,
        sentTo: order.guestEmail,
      })
    }

    // Complete the sales order lifecycle on Velocity
    try {
      const soTrace = meta.velocity?.salesOrderTrace
      if (soTrace) await completeVelocitySalesOrder(soTrace)
    } catch (err) {
      log.warn("velocity status — completeSalesOrder failed (non-critical)", { orderId: id, error: String(err) })
    }

    const email = order.guestEmail
    if (!email) {
      log.error("velocity status — order missing guestEmail", { orderId: id })
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

  if (poll.pollStatus === "FAILED") {
    await db
      .update(orders)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(eq(orders.id, id))
    return NextResponse.json({ orderId: id, status: "cancelled", paid: false })
  }

  return NextResponse.json({ orderId: id, status: "pending", paid: false })
}
