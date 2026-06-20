import { NextResponse } from "next/server"
import { eq, and, inArray, desc, asc } from "drizzle-orm"
import jsPDF from "jspdf"
import "jspdf-autotable"

import { db } from "@/db"
import { events, orders, tickets, ticketTiers } from "@/db/schema"
import { requireEventAccess } from "@/lib/event-access"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare module "jspdf" {
  interface jsPDF {
    autoTable: (options: Record<string, unknown>) => jsPDF
    lastAutoTable: { finalY: number }
  }
}

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

  // Fetch one row per issued ticket
  const ticketRows = await db
    .select({
      orderId: orders.id,
      guestName: orders.guestName,
      guestEmail: orders.guestEmail,
      guestPhone: orders.guestPhone,
      tierName: ticketTiers.name,
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

  // Build PDF
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" })

  // Title
  doc.setFontSize(16)
  doc.text(event.title, 14, 20)
  doc.setFontSize(10)
  doc.text(`Total attendees: ${ticketRows.length}`, 14, 28)
  doc.setFontSize(9)
  doc.text(`Generated: ${new Date().toLocaleDateString("en-GB", {
    day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
  })}`, 14, 34)

  // Table
  const tableColumn = ["Name", "Email", "Phone", "Ticket Type", "Checked In", "Holder"]
  const tableRows = ticketRows.map((r) => [
    r.guestName ?? "",
    r.guestEmail ?? "",
    r.guestPhone ?? "",
    r.tierName ?? "N/A",
    r.scannedAt ? "Yes" : "No",
    r.holderName ?? "",
  ])

  doc.autoTable({
    startY: 38,
    head: [tableColumn],
    body: tableRows,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [11, 18, 50] },
    alternateRowStyles: { fillColor: [246, 249, 252] },
    margin: { top: 38 },
  })

  const pdfBuffer = Buffer.from(doc.output("arraybuffer"))

  const filename = `${event.title.replace(/[^a-zA-Z0-9]/g, "_")}_attendees.pdf`

  return new NextResponse(pdfBuffer, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(pdfBuffer.length),
    },
  })
}
