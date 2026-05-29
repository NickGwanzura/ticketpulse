import { NextResponse } from "next/server"
import { eq } from "drizzle-orm"
import { db } from "@/db"
import { orders } from "@/db/schema"
import { auth } from "@/auth"
import { deliverTicketForPaidOrder, readDeliveryStatus } from "@/lib/delivery"
import { log } from "@/lib/logger"

type Params = { id: string }

export async function POST(req: Request, ctx: { params: Promise<Params> }) {
  const { id } = await ctx.params

  const session = await auth()
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
  }

  const [order] = await db.select().from(orders).where(eq(orders.id, id)).limit(1)
  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 })
  }

  if (order.status !== "paid") {
    return NextResponse.json(
      { error: `Cannot deliver: order status is "${order.status}", expected "paid"` },
      { status: 409 },
    )
  }

  log.info("admin deliver - starting ticket delivery", { orderId: id, adminId: session.user.id })

  const result = await deliverTicketForPaidOrder(id)
  const delivery = readDeliveryStatus(order.metadata)

  log.info("admin deliver - result", { orderId: id, result, delivery })

  if (!result.success && result.status === "FAILED") {
    return NextResponse.json(
      { error: result.error ?? "Delivery failed", delivery },
      { status: 500 },
    )
  }

  return NextResponse.json({
    success: true,
    status: result.status,
    ticketCount: result.ticketCount,
    emailSent: result.emailSent,
    delivery,
  })
}
