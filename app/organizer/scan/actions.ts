"use server"

import { and, eq } from "drizzle-orm"
import { db } from "@/db"
import { tickets, ticketTiers, events, orders } from "@/db/schema"
import { auth } from "@/auth"
import { requireEventAccess } from "@/lib/event-access"

export type ScanResult =
  | { ok: true; status: "new" | "duplicate"; ticket: { eventTitle: string; tierName: string; holder?: string; isStaffTicket?: boolean; staffRole?: string; staffName?: string } }
  | { ok: false; error: string }

export async function markTicketScannedAction(rawCode: string): Promise<ScanResult> {
  const session = await auth()
  if (!session) return { ok: false, error: "Not authenticated" }

  const code = rawCode.trim()
  if (!code) return { ok: false, error: "Empty code" }

  // Test ticket codes — accepted but not persisted in DB
  if (/^TEST-/i.test(code)) {
    return {
      ok: true,
      status: "new",
      ticket: { eventTitle: "🧪 Sample Ticket", tierName: "Test QR code — not valid for entry" },
    }
  }

  const lookupTicket = async (where: ReturnType<typeof eq> | ReturnType<typeof and>) => {
    const [ticket] = await db
      .select({
        id: tickets.id,
        qrCode: tickets.qrCode,
        eventId: tickets.eventId,
        scannedAt: tickets.scannedAt,
        orderId: tickets.orderId,
        status: tickets.status,
        tierName: ticketTiers.name,
        eventTitle: events.title,
        isStaffTicket: tickets.isStaffTicket,
        staffName: tickets.staffName,
        staffRole: tickets.staffRole,
      })
      .from(tickets)
      .leftJoin(ticketTiers, eq(ticketTiers.id, tickets.tierId))
      .leftJoin(events, eq(events.id, tickets.eventId))
      .where(where)
      .limit(1)
    return ticket
  }

  // Look up ticket by stored QR code first, then by the verification URL encoded in PDFs/wallet passes.
  let ticket = await lookupTicket(eq(tickets.qrCode, code))

  if (!ticket) {
    const parsed = parseVerificationUrl(code)
    if (parsed) {
      ticket = await lookupTicket(and(eq(tickets.id, parsed.ticketId), eq(tickets.orderId, parsed.orderId)))
    }
  }

  if (!ticket) {
    return { ok: false, error: "Ticket not found" }
  }

  // Verify the scanner owns or co-organises this event
  if (ticket.eventId) {
    const access = await requireEventAccess(ticket.eventId)
    if (!access.allowed) {
      return { ok: false, error: "You are not authorized to scan tickets for this event" }
    }
  }

  // Handle cancelled tickets
  if (ticket.status === "cancelled") {
    return { ok: false, error: "This ticket has been cancelled." }
  }

  // Check if already scanned
  if (ticket.scannedAt) {
    return {
      ok: true,
      status: "duplicate",
      ticket: {
        eventTitle: ticket.eventTitle ?? "Unknown event",
        tierName: ticket.isStaffTicket ? `Staff — ${ticket.staffName ?? "Unknown"}` : (ticket.tierName ?? "Ticket"),
        holder: ticket.isStaffTicket ? ticket.staffName ?? undefined : undefined,
        isStaffTicket: ticket.isStaffTicket ?? false,
        staffRole: ticket.isStaffTicket ? (ticket.staffRole ?? undefined) : undefined,
        staffName: ticket.isStaffTicket ? (ticket.staffName ?? undefined) : undefined,
      },
    }
  }

  // Mark as scanned
  await db
    .update(tickets)
    .set({ scannedAt: new Date(), status: "used" })
    .where(eq(tickets.id, ticket.id))

  // Look up buyer name from the order (for non-staff tickets)
  let holder: string | undefined
  if (ticket.isStaffTicket) {
    holder = ticket.staffName ?? undefined
  } else if (ticket.orderId) {
    const [orderRow] = await db
      .select({ guestName: orders.guestName, guestEmail: orders.guestEmail })
      .from(orders)
      .where(eq(orders.id, ticket.orderId))
      .limit(1)
    if (orderRow) {
      holder = orderRow.guestName ?? orderRow.guestEmail ?? undefined
    }
  }

  const tierLabel = ticket.isStaffTicket
    ? `Staff — ${ticket.staffRole ?? "Staff"}`
    : (ticket.tierName ?? "Ticket")

  return {
    ok: true,
    status: "new",
    ticket: {
      eventTitle: ticket.eventTitle ?? "Unknown event",
      tierName: tierLabel,
      holder,
      isStaffTicket: ticket.isStaffTicket ?? false,
      staffRole: ticket.isStaffTicket ? (ticket.staffRole ?? undefined) : undefined,
      staffName: ticket.isStaffTicket ? (ticket.staffName ?? undefined) : undefined,
    },
  }
}

function parseVerificationUrl(rawCode: string): { ticketId: string; orderId: string } | null {
  try {
    const url = new URL(rawCode)
    const match = url.pathname.match(/^\/tickets\/([0-9a-fA-F-]{36})\/verify$/)
    const orderId = url.searchParams.get("order")
    if (!match || !orderId) return null
    return { ticketId: match[1], orderId }
  } catch {
    return null
  }
}
