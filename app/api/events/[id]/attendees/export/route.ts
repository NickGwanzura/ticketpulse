import { NextResponse } from "next/server"
import { eq, and, inArray, desc, asc, sql } from "drizzle-orm"
import { db } from "@/db"
import { events, orders, orderItems, ticketTiers, tickets, ticketQuestions, ticketQuestionResponses } from "@/db/schema"
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

  // Fetch event questions
  const questions = await db
    .select({ id: ticketQuestions.id, question: ticketQuestions.question })
    .from(ticketQuestions)
    .where(eq(ticketQuestions.eventId, id))
    .orderBy(asc(ticketQuestions.sortOrder))

  // Fetch attendees — confirmed orders with ticket items
  const rows = await db
    .select({
      orderId: orders.id,
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
        // Only export orders with tickets delivered — same filter as the attendees page
        inArray(orders.status, ["paid", "awaiting_verification", "completed"]),
        eq(orderItems.type, "ticket"),
        sql`EXISTS (SELECT 1 FROM tickets t WHERE t.order_id = ${orders.id} AND t.event_id = ${orders.eventId})`,
      ),
    )
    .orderBy(desc(orders.createdAt))

  const orderIds = [...new Set(rows.map((r) => r.orderId))]
  const responses = orderIds.length > 0
    ? await db
        .select({
          orderId: ticketQuestionResponses.orderId,
          questionId: ticketQuestionResponses.questionId,
          response: ticketQuestionResponses.response,
        })
        .from(ticketQuestionResponses)
        .where(inArray(ticketQuestionResponses.orderId, orderIds))
    : []

  const responseMap = new Map<string, Map<string, string>>()
  for (const r of responses) {
    if (!responseMap.has(r.orderId)) {
      responseMap.set(r.orderId, new Map())
    }
    responseMap.get(r.orderId)!.set(r.questionId, r.response)
  }

  // Build CSV
  const questionHeaders = questions.map((q) => escapeCsv(q.question)).join(",")
  const header = `Name,Email,Phone,Ticket Type,Qty,Unit Price,Total,Checked In,QR Code${questionHeaders ? "," + questionHeaders : ""}`
  const csvRows = rows.map((r) => {
    const name = escapeCsv(r.guestName ?? "")
    const email = escapeCsv(r.guestEmail ?? "")
    const phone = escapeCsv(r.guestPhone ?? "")
    const tier = escapeCsv(r.tierName ?? "N/A")
    const checkedIn = r.scannedAt ? "Yes" : "No"
    const qr = escapeCsv(r.qrCode ?? "")
    const qCols = questions.map((q) => escapeCsv(responseMap.get(r.orderId)?.get(q.id) ?? "")).join(",")
    return `${name},${email},${phone},${tier},${r.quantity},${r.unitPrice},${r.total},${checkedIn},${qr}${qCols ? "," + qCols : ""}`
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
