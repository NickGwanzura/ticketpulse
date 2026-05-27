import { NextResponse } from "next/server"
import { and, eq } from "drizzle-orm"
import { db } from "@/db"
import { orders } from "@/db/schema"
import { pollVelocityTransaction, completeVelocitySalesOrder } from "@/lib/velocity"
import { startOrderVerification } from "@/lib/order-verification"
import { log } from "@/lib/logger"

type Params = { id: string }

// Buyer lands here in the browser after completing Velocity's hosted checkout
// (VMC card flow). We poll Velocity for the final status, transition the order
// atomically using the same idempotency pattern as other routes, then forward
// the buyer to the order page.
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

  const meta = (order.metadata ?? {}) as { velocity?: { salesOrderTrace: string; transactionTrace: string; workflowId: string } }
  const txTrace = meta.velocity?.transactionTrace

  if (!txTrace) {
    return NextResponse.redirect(`${origin}/orders/${id}?awaiting=1`)
  }

  try {
    const poll = await pollVelocityTransaction(txTrace)
    if (poll.pollStatus === "SUCCESS" && order.guestEmail) {
      // Atomic idempotency gate — only transitions if still pending
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
        const soTrace = meta.velocity?.salesOrderTrace
        if (soTrace) await completeVelocitySalesOrder(soTrace)

        await startOrderVerification({ orderId: id, email: order.guestEmail, origin })
      }
    } else if (poll.pollStatus === "FAILED") {
      await db
        .update(orders)
        .set({ status: "cancelled", updatedAt: new Date() })
        .where(eq(orders.id, id))
      return NextResponse.redirect(`${origin}/orders/${id}?error=payment_failed`)
    }
  } catch (err) {
    log.warn("velocity return — poll failed", { orderId: id, error: String(err) })
  }

  return NextResponse.redirect(`${origin}/orders/${id}?awaiting=1`)
}
