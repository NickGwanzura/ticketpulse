import { NextResponse } from "next/server"
import { eq, and, inArray, desc, asc } from "drizzle-orm"
import { db } from "@/db"
import { events, orders, orderItems, ticketTiers, tickets, ticketQuestions, ticketQuestionResponses } from "@/db/schema"
import { requireEventAccess } from "@/lib/event-access"

type RouteParams = { params: Promise<{ id: string }> }

export async function GET(_req: Request, ctx: RouteParams) {
  const { id } = await ctx.params

  const access = await requireEventAccess(id)
  if (!access.allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const [event] = await db
    .select({ title: events.title })
    .from(events)
    .where(eq(events.id, id))
    .limit(1)
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 })
  }

  // Fetch event questions
  const questions = await db
    .select({ id: ticketQuestions.id, question: ticketQuestions.question })
    .from(ticketQuestions)
    .where(eq(ticketQuestions.eventId, id))
    .orderBy(asc(ticketQuestions.sortOrder))

  // Fetch one CSV row per issued buyer ticket. Keep order item totals separate
  // so a multi-ticket order does not repeat the full line total on each ticket.
  const ticketRows = await db
    .select({
      orderId: orders.id,
      guestName: orders.guestName,
      guestEmail: orders.guestEmail,
      guestPhone: orders.guestPhone,
      tierName: ticketTiers.name,
      tierId: tickets.tierId,
      scannedAt: tickets.scannedAt,
      holderName: tickets.holderName,
    })
    .from(tickets)
    .innerJoin(orders, eq(orders.id, tickets.orderId))
    .leftJoin(ticketTiers, eq(ticketTiers.id, tickets.tierId))
    .where(
      and(
        eq(tickets.eventId, id),
        eq(tickets.isStaffTicket, false),
        inArray(tickets.status, ["sold", "used"]),
        inArray(orders.status, ["paid", "completed"]),
      ),
    )
    .orderBy(desc(orders.createdAt), asc(tickets.createdAt))

  const orderIds = [...new Set(ticketRows.map((r) => r.orderId))]
  const itemRows = orderIds.length > 0
    ? await db
        .select({
          orderId: orderItems.orderId,
          tierId: orderItems.tierId,
          quantity: orderItems.quantity,
          total: orderItems.total,
        })
        .from(orderItems)
        .where(and(inArray(orderItems.orderId, orderIds), eq(orderItems.type, "ticket")))
    : []

  const itemTotals = new Map<string, { quantity: number; total: number }>()
  for (const item of itemRows) {
    const key = `${item.orderId}:${item.tierId ?? ""}`
    const existing = itemTotals.get(key) ?? { quantity: 0, total: 0 }
    existing.quantity += Number(item.quantity ?? 0)
    existing.total += Number(item.total ?? 0)
    itemTotals.set(key, existing)
  }

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
  const header = `Name,Email,Phone,Ticket Type,Qty,Unit Price,Total,Checked In,Holder (if transferred)${questionHeaders ? "," + questionHeaders : ""}`
  const csvRows = ticketRows.map((r) => {
    const name = escapeCsv(r.guestName ?? "")
    const email = escapeCsv(r.guestEmail ?? "")
    const phone = escapeCsv(r.guestPhone ?? "")
    const tier = escapeCsv(r.tierName ?? "N/A")
    const checkedIn = r.scannedAt ? "Yes" : "No"
    const holder = escapeCsv(r.holderName ?? "")
    const qCols = questions.map((q) => escapeCsv(responseMap.get(r.orderId)?.get(q.id) ?? "")).join(",")
    const itemTotal = itemTotals.get(`${r.orderId}:${r.tierId ?? ""}`) ?? { quantity: 0, total: 0 }
    const perTicketTotal = itemTotal.quantity > 0 ? itemTotal.total / itemTotal.quantity : 0
    return `${name},${email},${phone},${tier},1,${formatAmount(perTicketTotal)},${formatAmount(perTicketTotal)},${checkedIn},${holder}${qCols ? "," + qCols : ""}`
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

function formatAmount(value: number): string {
  if (!Number.isFinite(value)) return "0.00"
  return value.toFixed(2)
}
