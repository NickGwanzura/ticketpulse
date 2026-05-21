import { NextResponse } from "next/server"
import { eq, sql } from "drizzle-orm"
import { auth } from "@/auth"
import { db } from "@/db"
import { events, orders, orderItems, ticketTiers, tickets, users } from "@/db/schema"
import { sendOrderConfirmationEmail, sendEmail, adminEmail } from "@/lib/email"
import { saleNotificationEmail } from "@/lib/email-templates"

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

  // ── Create individual ticket records with QR codes ─────────────────────────
  // Each ticket-type order item produces one record per quantity.
  // QR codes use the DB UUID format so they can be looked up server-side.
  try {
    const itemsWithIds = await db
      .select({
        id: orderItems.id,
        tierId: orderItems.tierId,
        quantity: orderItems.quantity,
      })
      .from(orderItems)
      .where(eq(orderItems.orderId, id))

    const ticketValues: {
      tierId: string
      eventId: string
      orderId: string
      userId: string | null
      status: "sold"
      qrCode: string
    }[] = []

    for (const item of itemsWithIds) {
      if (!item.tierId) continue
      for (let i = 0; i < item.quantity; i++) {
        ticketValues.push({
          tierId: item.tierId,
          eventId: order.eventId,
          orderId: id,
          userId: session.user.id,
          status: "sold",
          qrCode: `${id}-${item.id}-${i}`,
        })
      }
    }

    if (ticketValues.length > 0) {
      await db.insert(tickets).values(ticketValues)

      // Update sold quantities for each tier
      const tierCounts = new Map<string, number>()
      for (const t of ticketValues) {
        tierCounts.set(t.tierId, (tierCounts.get(t.tierId) ?? 0) + 1)
      }
      for (const [tierId, count] of tierCounts) {
        await db
          .update(ticketTiers)
          .set({ soldQuantity: sql`${ticketTiers.soldQuantity} + ${count}` })
          .where(eq(ticketTiers.id, tierId))
      }
    }
  } catch (err) {
    console.error("[finalize] failed to create ticket records:", err)
  }

  // Fire the branded ticket confirmation email. Failures here shouldn't
  // block the user from seeing their order — log and continue.
  let ev: { title: string; startsAt: Date; venue: string | null; organizerId: string } | null = null
  let saleLines: { label: string; qty: number; amount: string }[] = []
  try {
    const [event] = await db
      .select({
        title: events.title,
        startsAt: events.startsAt,
        venue: events.venue,
        organizerId: events.organizerId,
      })
      .from(events)
      .where(eq(events.id, order.eventId))
      .limit(1)

    ev = event ?? null

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
    saleLines = lines

    await sendOrderConfirmationEmail({
      to: session.user.email,
      buyerName: order.guestName ?? session.user.name,
      orderId: id,
      eventTitle: ev?.title ?? "your event",
      eventDate: ev?.startsAt
        ? new Date(ev.startsAt).toLocaleDateString("en-GB", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
          })
        : "TBA",
      eventVenue: ev?.venue ?? undefined,
      lines,
      total: order.totalAmount,
      currency: order.currency ?? "USD",
      ticketUrl: `${origin}/orders/${id}`,
    })
  } catch (err) {
    console.error("[finalize] failed to send order confirmation:", err)
  }

  // ── Notify the event organiser about the sale ─────────────────────────────
  if (ev) {
    try {
      const [org] = await db
        .select({ name: users.name, email: users.email })
        .from(users)
        .where(eq(users.id, ev.organizerId))
        .limit(1)

      if (org?.email) {
        const { html, text } = saleNotificationEmail({
          role: "organizer",
          eventTitle: ev.title,
          buyerName: order.guestName ?? session.user.name ?? "A buyer",
          orderId: id,
          items: saleLines,
          total: String(order.totalAmount),
          currency: order.currency ?? "USD",
          organizerName: org.name,
        })
        await sendEmail({
          to: org.email,
          subject: `🎟️ New ticket sale — ${ev.title}`,
          html,
          text,
        })
      }
    } catch (err) {
      console.error("[finalize] failed to notify organiser:", err)
    }

    // ── Notify the platform admin about the sale ──────────────────────────────
    try {
      const { html, text } = saleNotificationEmail({
        role: "admin",
        eventTitle: ev.title,
        buyerName: order.guestName ?? session.user.name ?? "A buyer",
        orderId: id,
        items: saleLines,
        total: String(order.totalAmount),
        currency: order.currency ?? "USD",
      })
      await sendEmail({
        to: adminEmail,
        subject: `🎟️ Sale alert — ${ev.title}`,
        html,
        text,
      })
    } catch (err) {
      console.error("[finalize] failed to notify admin about sale:", err)
    }
  }

  return NextResponse.redirect(`${origin}/orders/${id}?welcome=1`)
}
