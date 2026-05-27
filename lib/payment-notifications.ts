import "server-only"
import { eq } from "drizzle-orm"
import { db } from "@/db"
import { orders, events, users, orderItems, ticketTiers } from "@/db/schema"
import { sendEmail, adminEmail } from "@/lib/email"
import { saleNotificationEmail } from "@/lib/email-templates"
import { log } from "@/lib/logger"

export async function notifyPaymentSuccess(orderId: string) {
  try {
    const [order] = await db
      .select({
        id: orders.id,
        eventId: orders.eventId,
        guestName: orders.guestName,
        totalAmount: orders.totalAmount,
        currency: orders.currency,
      })
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1)

    if (!order) {
      log.warn("notifyPaymentSuccess — order not found", { orderId })
      return
    }

    const [ev] = await db
      .select({
        title: events.title,
        organizerId: events.organizerId,
      })
      .from(events)
      .where(eq(events.id, order.eventId))
      .limit(1)

    if (!ev) {
      log.warn("notifyPaymentSuccess — event not found", { orderId, eventId: order.eventId })
      return
    }

    const [org] = await db
      .select({ name: users.name, email: users.email })
      .from(users)
      .where(eq(users.id, ev.organizerId))
      .limit(1)

    const items = await db
      .select({
        qty: orderItems.quantity,
        total: orderItems.total,
        tierName: ticketTiers.name,
      })
      .from(orderItems)
      .leftJoin(ticketTiers, eq(ticketTiers.id, orderItems.tierId))
      .where(eq(orderItems.orderId, orderId))

    const saleLines = items.map((i) => ({
      label: i.tierName ?? "Ticket",
      qty: i.qty,
      amount: `${i.total} ${order.currency ?? "USD"}`,
    }))

    const buyerName = order.guestName ?? "Someone"

    if (org?.email) {
      const { html, text } = saleNotificationEmail({
        role: "organizer",
        eventTitle: ev.title,
        buyerName,
        orderId,
        items: saleLines,
        total: String(order.totalAmount),
        currency: order.currency ?? "USD",
        organizerName: org.name,
      })
      await sendEmail({ to: org.email, subject: `🎟️ New ticket sale — ${ev.title}`, html, text }).catch((err) => {
        log.warn("notifyPaymentSuccess — failed to notify organizer", { orderId, error: String(err) })
      })
    }

    {
      const { html, text } = saleNotificationEmail({
        role: "admin",
        eventTitle: ev.title,
        buyerName,
        orderId,
        items: saleLines,
        total: String(order.totalAmount),
        currency: order.currency ?? "USD",
      })
      await sendEmail({ to: adminEmail, subject: `🎟️ Sale alert — ${ev.title}`, html, text }).catch((err) => {
        log.warn("notifyPaymentSuccess — failed to notify admin", { orderId, error: String(err) })
      })
    }
  } catch (err) {
    log.error("notifyPaymentSuccess — error", { orderId, error: String(err) })
  }
}

export async function notifyPaymentFailed(orderId: string, reason: string) {
  try {
    const [order] = await db
      .select({
        id: orders.id,
        eventId: orders.eventId,
        guestName: orders.guestName,
        guestEmail: orders.guestEmail,
        totalAmount: orders.totalAmount,
        currency: orders.currency,
        paymentMethod: orders.paymentMethod,
      })
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1)

    if (!order) return

    const [ev] = await db
      .select({ title: events.title })
      .from(events)
      .where(eq(events.id, order.eventId))
      .limit(1)

    const eventTitle = ev?.title ?? "Unknown event"

    const html = `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:520px;margin:0 auto;">
        <h1 style="font-size:20px;font-weight:700;color:#1a1a2e;">Payment Failed</h1>
        <p style="font-size:14px;color:#555;">A payment attempt failed on <strong>TicketPulse</strong>.</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0;">
          <tr><td style="padding:6px 12px 6px 0;font-size:13px;font-weight:600;color:#888;white-space:nowrap;">Order</td><td style="padding:6px 0;font-size:14px;color:#1a1a2e;">${orderId}</td></tr>
          <tr><td style="padding:6px 12px 6px 0;font-size:13px;font-weight:600;color:#888;white-space:nowrap;">Event</td><td style="padding:6px 0;font-size:14px;color:#1a1a2e;">${eventTitle}</td></tr>
          <tr><td style="padding:6px 12px 6px 0;font-size:13px;font-weight:600;color:#888;white-space:nowrap;">Amount</td><td style="padding:6px 0;font-size:14px;color:#1a1a2e;">${order.totalAmount} ${order.currency ?? "USD"}</td></tr>
          <tr><td style="padding:6px 12px 6px 0;font-size:13px;font-weight:600;color:#888;white-space:nowrap;">Method</td><td style="padding:6px 0;font-size:14px;color:#1a1a2e;">${order.paymentMethod ?? "N/A"}</td></tr>
          <tr><td style="padding:6px 12px 6px 0;font-size:13px;font-weight:600;color:#888;white-space:nowrap;">Buyer</td><td style="padding:6px 0;font-size:14px;color:#1a1a2e;">${order.guestName ?? "N/A"} · ${order.guestEmail ?? "N/A"}</td></tr>
          <tr><td style="padding:6px 12px 6px 0;font-size:13px;font-weight:600;color:#888;white-space:nowrap;">Reason</td><td style="padding:6px 0;font-size:14px;color:#d32f2f;">${reason}</td></tr>
        </table>
      </div>`

    const text = [
      "Payment Failed",
      "",
      `A payment attempt failed on TicketPulse.`,
      "",
      `Order: ${orderId}`,
      `Event: ${eventTitle}`,
      `Amount: ${order.totalAmount} ${order.currency ?? "USD"}`,
      `Method: ${order.paymentMethod ?? "N/A"}`,
      `Buyer: ${order.guestName ?? "N/A"} (${order.guestEmail ?? "N/A"})`,
      `Reason: ${reason}`,
      "",
      "TicketPulse",
    ].join("\n")

    await sendEmail({
      to: adminEmail,
      subject: `❌ Payment failed — ${eventTitle}`,
      html,
      text,
    }).catch((err) => {
      log.warn("notifyPaymentFailed — send failed", { orderId, error: String(err) })
    })
  } catch (err) {
    log.error("notifyPaymentFailed — error", { orderId, error: String(err) })
  }
}
