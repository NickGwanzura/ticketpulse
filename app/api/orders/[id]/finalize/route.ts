import { NextResponse } from "next/server"
import { eq } from "drizzle-orm"
import { auth } from "@/auth"
import { db } from "@/db"
import { events, orders, orderItems, ticketTiers } from "@/db/schema"
import { sendOrderConfirmationEmail } from "@/lib/email"

type Params = { id: string }

export async function GET(req: Request, ctx: { params: Promise<Params> }) {
  const { id } = await ctx.params
  const origin = new URL(req.url).origin

  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.redirect(
      `${origin}/auth/signin?callbackUrl=${encodeURIComponent(`/api/orders/${id}/finalize`)}`,
    )
  }

  const [order] = await db.select().from(orders).where(eq(orders.id, id)).limit(1)
  if (!order) return NextResponse.redirect(`${origin}/orders?error=not_found`)

  // Email match — protects against a session user clicking someone else's
  // verification link from their own inbox.
  const userEmail = session.user.email.toLowerCase()
  const guestEmail = order.guestEmail?.toLowerCase()
  if (guestEmail && guestEmail !== userEmail) {
    return NextResponse.redirect(`${origin}/orders?error=mismatch`)
  }

  // Already finalized — just send them to the order page.
  if (order.status !== "awaiting_verification") {
    return NextResponse.redirect(`${origin}/orders/${id}`)
  }

  // Token expiry guard. NextAuth will refuse stale tokens at the callback
  // step, but if a buyer somehow got here after the window we still fail safe.
  if (order.verificationExpires && order.verificationExpires < new Date()) {
    return NextResponse.redirect(`${origin}/orders/${id}?error=expired`)
  }

  await db
    .update(orders)
    .set({
      status: "paid",
      userId: session.user.id,
      verifiedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(orders.id, id))

  // Fire the branded ticket confirmation email. Failures here shouldn't
  // block the user from seeing their order — log and continue.
  try {
    const [event] = await db.select().from(events).where(eq(events.id, order.eventId)).limit(1)
    const items = await db
      .select({
        qty: orderItems.quantity,
        unit: orderItems.unitPrice,
        total: orderItems.total,
        tierName: ticketTiers.name,
      })
      .from(orderItems)
      .leftJoin(ticketTiers, eq(ticketTiers.id, orderItems.tierId))
      .where(eq(orderItems.orderId, id))

    const lines = items.map((i) => ({
      label: i.tierName ?? "Ticket",
      qty: i.qty,
      amount: `${i.total} ${order.currency ?? "USD"}`,
    }))

    await sendOrderConfirmationEmail({
      to: session.user.email,
      buyerName: order.guestName ?? session.user.name,
      orderId: id,
      eventTitle: event?.title ?? "your event",
      eventDate: event?.startsAt
        ? new Date(event.startsAt).toLocaleDateString("en-GB", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
          })
        : "TBA",
      eventVenue: event?.venue ?? undefined,
      lines,
      total: order.totalAmount,
      currency: order.currency ?? "USD",
      ticketUrl: `${origin}/orders/${id}`,
    })
  } catch (err) {
    console.error("[finalize] failed to send order confirmation:", err)
  }

  return NextResponse.redirect(`${origin}/orders/${id}?welcome=1`)
}
