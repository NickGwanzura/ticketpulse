import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/db"
import { orders, events, users, tickets } from "@/db/schema"
import { or, ilike, and, eq, desc } from "drizzle-orm"

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const q = searchParams.get("q")?.trim() ?? ""

  if (!q || q.length < 2) {
    return NextResponse.json({ results: [] })
  }

  const isAdmin = session.user.role === "admin"
  const userId = session.user.id

  const results: Array<{
    id: string
    type: string
    title: string
    subtitle: string
    href: string
  }> = []

  // Search orders
  if (isAdmin) {
    const orderResults = await db
      .select({
        id: orders.id,
        guestName: orders.guestName,
        guestEmail: orders.guestEmail,
        status: orders.status,
        eventTitle: events.title,
      })
      .from(orders)
      .leftJoin(events, eq(events.id, orders.eventId))
      .where(
        or(
          ilike(orders.guestEmail, `%${q}%`),
          ilike(orders.guestName, `%${q}%`),
          ilike(orders.id, `%${q}%`)
        )
      )
      .orderBy(desc(orders.createdAt))
      .limit(5)

    for (const o of orderResults) {
      results.push({
        id: o.id,
        type: "order",
        title: `Order ${o.id.slice(0, 8)}`,
        subtitle: `${o.guestName ?? o.guestEmail ?? "Guest"} · ${o.status} · ${o.eventTitle ?? "Event"}`,
        href: `/admin/orders?q=${encodeURIComponent(q)}`,
      })
    }
  }

  // Search events
  const eventWhere = isAdmin
    ? or(ilike(events.title, `%${q}%`), ilike(events.city, `%${q}%`), ilike(events.venue, `%${q}%`))
    : and(
        eq(events.organizerId, userId),
        or(ilike(events.title, `%${q}%`), ilike(events.city, `%${q}%`))
      )

  const eventResults = await db
    .select({ id: events.id, title: events.title, city: events.city, status: events.status })
    .from(events)
    .where(eventWhere)
    .orderBy(desc(events.createdAt))
    .limit(5)

  for (const e of eventResults) {
    results.push({
      id: e.id,
      type: "event",
      title: e.title,
      subtitle: `${e.city ?? "No city"} · ${e.status}`,
      href: `/organizer/events/${e.id}`,
    })
  }

  // Search users (admin only)
  if (isAdmin) {
    const userResults = await db
      .select({ id: users.id, name: users.name, email: users.email, role: users.role })
      .from(users)
      .where(or(ilike(users.name, `%${q}%`), ilike(users.email, `%${q}%`)))
      .orderBy(desc(users.createdAt))
      .limit(5)

    for (const u of userResults) {
      results.push({
        id: u.id,
        type: "user",
        title: u.name ?? "—",
        subtitle: `${u.email} · ${u.role}`,
        href: `/admin/users?q=${encodeURIComponent(q)}`,
      })
    }
  }

  // Search tickets (admin only, by QR code)
  if (isAdmin) {
    const ticketResults = await db
      .select({
        id: tickets.id,
        qrCode: tickets.qrCode,
        status: tickets.status,
        eventTitle: events.title,
      })
      .from(tickets)
      .leftJoin(events, eq(events.id, tickets.eventId))
      .where(ilike(tickets.qrCode, `%${q}%`))
      .limit(5)

    for (const t of ticketResults) {
      results.push({
        id: t.id,
        type: "ticket",
        title: `Ticket ${t.id.slice(0, 8)}`,
        subtitle: `${t.status} · ${t.eventTitle ?? "Event"}`,
        href: `/admin/tickets?q=${encodeURIComponent(q)}`,
      })
    }
  }

  return NextResponse.json({ results })
}
