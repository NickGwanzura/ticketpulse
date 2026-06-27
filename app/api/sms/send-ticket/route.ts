import { NextResponse } from "next/server"
import { eq } from "drizzle-orm"
import { db } from "@/db"
import { orders } from "@/db/schema"
import { sendTicketConfirmationSms, formatMsisdn } from "@/lib/sms"
import { log } from "@/lib/logger"

/**
 * POST /api/sms/send-ticket
 *
 * Sends a ticket-confirmation SMS via VelocityAfrica to the buyer.
 * Called non-blocking from the delivery flow; can also be triggered
 * manually from admin or the resend-tickets endpoint.
 *
 * Body: { orderId: string }
 * Response: { ok: boolean, sentTo?: string, error?: string }
 */
export async function POST(req: Request) {
  try {
    const { orderId } = await req.json()
    if (!orderId || typeof orderId !== "string") {
      return NextResponse.json({ error: "orderId is required" }, { status: 400 })
    }

    const [order] = await db
      .select({ id: orders.id, guestPhone: orders.guestPhone })
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1)

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 })
    }

    if (!order.guestPhone) {
      return NextResponse.json({ error: "Order has no guest phone number" }, { status: 400 })
    }

    const result = await sendTicketConfirmationSms(order.guestPhone)

    log.info("sms — ticket confirmation sent", {
      orderId,
      msisdn: formatMsisdn(order.guestPhone),
      batchId: result.result,
    })

    return NextResponse.json({ ok: true, sentTo: order.guestPhone, batchId: result.result })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    log.error("sms — send-ticket failed", { error: msg })
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
