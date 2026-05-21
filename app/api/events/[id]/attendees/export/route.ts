import { NextResponse } from "next/server"
import { eq, and, inArray, desc, sql } from "drizzle-orm"
import { db } from "@/db"
import { events, orders, orderItems, ticketTiers, tickets } from "@/db/schema"
import { auth } from "@/auth"

type RouteParams = { params: Promise<{ id: string }> }

export async function GET(_req: Request, ctx: RouteParams) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await ctx.params

  // Verify ownership
  const [event] = await db
    .select({ title: events.title, organizerId: events.organizerId })
    .from(events)
    .where(eq(events.id, id))
    .limit(1)
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 })
  }
  if (event.organizerId !== session.user.id && session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  // Fetch attendees — confirmed orders with ticket items
  const rows = await db
    .select({
      guestName: orders.guestName,
      guestEmail: orders.guestEmail,
      guestPhone: orders.guestPhone,
      orderStatus: orders.status,
      tierName: ticketTiers.name,
      quantity: orderItems.quantity,
      unitPrice: orderItems.unitPrice,
      total: orderItems.total,
      ticketStatus: tickets.status,
      scannedAt: tickets.scannedAt,
      qrCode: tickets.qrCode,
    })
    .from(orders)
    .innerJoin(orderItems, eq(orderItems.orderId, orders.id))
    .leftJoin(ticketTiers, eq(ticketTiers.id, orderItems.tierId))
    .leftJoin(
      tickets,
      and(eq(tickets.orderId, orders.id), eq(tickets.tierId, orderItems.tierId)),
    )
    .where(
      and(
        eq(orders.eventId, id),
        inArray(orders.status, ["paid"]),
        eq(orderItems.type, "ticket"),
      ),
    )
    .orderBy(desc(orders.createdAt))

  // Build CSV
  const header = "Name,Email,Phone,Ticket Type,Qty,Unit Price,Total,Checked In,QR Code"
  const csvRows = rows.map((r) => {
    const name = escapeCsv(r.guestName ?? "")
    const email = escapeCsv(r.guestEmail ?? "")
    const phone = escapeCsv(r.guestPhone ?? "")
    const tier = escapeCsv(r.tierName ?? "N/A")
    const checkedIn = r.scannedAt ? "Yes" : "No"
    const qr = escapeCsv(r.qrCode ?? "")
    return `${name},${email},${phone},${tier},${r.quantity},${r.unitPrice},${r.total},${checkedIn},${qr}`
  })

  const csv = [header, ...csvRows].join("\n")
  const filename = `${event.title.replace(/[^a-zA-Z0-9]/g, "_")}_attendees.csv`

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  })
}

function escapeCsv(val: string): string {
  if (val.includes(",") || val.includes('"') || val.includes("\n")) {
    return `"${val.replace(/"/g, '""')}"`
  }
  return val
}
