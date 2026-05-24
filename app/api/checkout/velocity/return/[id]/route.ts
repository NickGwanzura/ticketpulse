import { NextResponse } from "next/server"
import { eq } from "drizzle-orm"
import { db } from "@/db"
import { orders } from "@/db/schema"
import { pollVelocityTransaction, completeVelocitySalesOrder } from "@/lib/velocity"
import { startOrderVerification } from "@/lib/order-verification"
import { log } from "@/lib/logger"

type Params = { id: string }

export async function GET(req: Request, ctx: { params: Promise<Params> }) {
  const { id } = await ctx.params
  const origin = new URL(req.url).origin

  const [order] = await db.select().from(orders).where(eq(orders.id, id)).limit(1)
  if (!order) {
    return NextResponse.redirect(`${origin}/checkout?error=not_found`)
  }

  if (order.status === "pending") {
    const meta = (order.metadata ?? {}) as { velocity?: { salesOrderTrace: string; transactionTrace: string; workflowId: string } }
    const txTrace = meta.velocity?.transactionTrace

    if (txTrace) {
      try {
        const poll = await pollVelocityTransaction(txTrace)
        if (poll.pollStatus === "SUCCESS" && order.guestEmail) {
          await db
            .update(orders)
            .set({ paidAt: new Date(), updatedAt: new Date() })
            .where(eq(orders.id, id))

          const soTrace = meta.velocity?.salesOrderTrace
          if (soTrace) await completeVelocitySalesOrder(soTrace)

          await startOrderVerification({ orderId: id, email: order.guestEmail, origin })
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
    }
  }

  return NextResponse.redirect(`${origin}/orders/${id}?awaiting=1`)
}
