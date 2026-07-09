import { and, eq, isNull } from "drizzle-orm"

import { db } from "@/db"
import { events, orders, ticketScanLogs, tickets, ticketTiers } from "@/db/schema"
import { requireEventAccess } from "@/lib/event-access"

export type ScanResult =
  | { ok: true; status: "new" | "duplicate"; ticket: { eventTitle: string; tierName: string; holder?: string; isStaffTicket?: boolean; staffRole?: string; staffName?: string } }
  | { ok: false; error: string }

export type ScanContext = {
  scannerUserId?: string | null
  source?: string | null
  userAgent?: string | null
  ipAddress?: string | null
}

type LookupTicket = {
  id: string
  qrCode: string | null
  eventId: string
  scannedAt: Date | null
  orderId: string | null
  status: "available" | "reserved" | "sold" | "used" | "refunded" | "cancelled" | null
  tierName: string | null
  eventTitle: string | null
  isStaffTicket: boolean | null
  staffName: string | null
  staffRole: "security" | "usher" | "dj_sound" | "bar_staff" | "vip_host" | "media" | "other" | null
}

export async function markTicketScanned(rawCode: string, context: ScanContext = {}): Promise<ScanResult> {
  const code = rawCode.trim()
  if (!code) return { ok: false, error: "Empty code" }

  const logScanAttempt = async ({
    ticket,
    outcome,
    reason,
  }: {
    ticket?: LookupTicket | null
    outcome: "valid" | "duplicate" | "rejected" | "unauthorized" | "not_found"
    reason?: string | null
  }) => {
    try {
      await db.insert(ticketScanLogs).values({
        ticketId: ticket?.id ?? null,
        eventId: ticket?.eventId ?? null,
        orderId: ticket?.orderId ?? null,
        scannerUserId: context.scannerUserId ?? null,
        rawCode: code,
        outcome,
        reason: reason ?? null,
        source: context.source ?? "organizer_web",
        userAgent: context.userAgent ?? null,
        ipAddress: context.ipAddress ?? null,
      })
    } catch (err) {
      console.error("[ticket-scan] failed to log scan attempt", err)
    }
  }

  if (/^TEST-/i.test(code)) {
    const reason = "Demo ticket only. Do not admit this guest."
    await logScanAttempt({ outcome: "rejected", reason })
    return { ok: false, error: reason }
  }

  const lookupTicket = async (where: ReturnType<typeof eq> | ReturnType<typeof and>): Promise<LookupTicket | undefined> => {
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

  let ticket = await lookupTicket(eq(tickets.qrCode, code))

  if (!ticket) {
    const parsed = parseVerificationUrl(code)
    if (parsed) {
      ticket = await lookupTicket(and(eq(tickets.id, parsed.ticketId), eq(tickets.orderId, parsed.orderId)))
    }
  }

  if (!ticket) {
    await logScanAttempt({ outcome: "not_found", reason: "Ticket not found" })
    return { ok: false, error: "Ticket not found" }
  }

  if (ticket.eventId) {
    const access = await requireEventAccess(ticket.eventId)
    if (!access.allowed) {
      await logScanAttempt({ ticket, outcome: "unauthorized", reason: "Scanner is not authorized for this event" })
      return { ok: false, error: "You are not authorized to scan tickets for this event" }
    }
  }

  if (ticket.status !== "sold" && ticket.status !== "used") {
    const reason =
      ticket.status === "cancelled"
        ? "This ticket has been cancelled."
        : ticket.status === "refunded"
          ? "This ticket has been refunded."
          : "This ticket is not active for entry."
    await logScanAttempt({ ticket, outcome: "rejected", reason })
    return { ok: false, error: reason }
  }

  if (ticket.scannedAt || ticket.status === "used") {
    await logScanAttempt({ ticket, outcome: "duplicate", reason: "Ticket was already scanned" })
    return {
      ok: true,
      status: "duplicate",
      ticket: {
        eventTitle: ticket.eventTitle ?? "Unknown event",
        tierName: ticket.isStaffTicket ? `Staff - ${ticket.staffName ?? "Unknown"}` : (ticket.tierName ?? "Ticket"),
        holder: ticket.isStaffTicket ? ticket.staffName ?? undefined : undefined,
        isStaffTicket: ticket.isStaffTicket ?? false,
        staffRole: ticket.isStaffTicket ? (ticket.staffRole ?? undefined) : undefined,
        staffName: ticket.isStaffTicket ? (ticket.staffName ?? undefined) : undefined,
      },
    }
  }

  const [updated] = await db
    .update(tickets)
    .set({ scannedAt: new Date(), status: "used" })
    .where(and(eq(tickets.id, ticket.id), eq(tickets.status, "sold"), isNull(tickets.scannedAt)))
    .returning({ id: tickets.id })

  if (!updated) {
    const fresh = await lookupTicket(eq(tickets.id, ticket.id))
    if (fresh?.scannedAt || fresh?.status === "used") {
      await logScanAttempt({ ticket: fresh, outcome: "duplicate", reason: "Ticket was already scanned" })
      return {
        ok: true,
        status: "duplicate",
        ticket: {
          eventTitle: fresh.eventTitle ?? "Unknown event",
          tierName: fresh.isStaffTicket ? `Staff - ${fresh.staffName ?? "Unknown"}` : (fresh.tierName ?? "Ticket"),
          holder: fresh.isStaffTicket ? fresh.staffName ?? undefined : undefined,
          isStaffTicket: fresh.isStaffTicket ?? false,
          staffRole: fresh.isStaffTicket ? (fresh.staffRole ?? undefined) : undefined,
          staffName: fresh.isStaffTicket ? (fresh.staffName ?? undefined) : undefined,
        },
      }
    }

    const reason = "Ticket status changed before it could be scanned."
    await logScanAttempt({ ticket: fresh ?? ticket, outcome: "rejected", reason })
    return { ok: false, error: reason }
  }

  let holder: string | undefined
  if (ticket.isStaffTicket) {
    holder = ticket.staffName ?? undefined
  } else if (ticket.orderId) {
    const [orderRow] = await db
      .select({ guestName: orders.guestName, guestEmail: orders.guestEmail })
      .from(orders)
      .where(eq(orders.id, ticket.orderId))
      .limit(1)
    holder = orderRow?.guestName ?? orderRow?.guestEmail ?? undefined
  }

  await logScanAttempt({ ticket, outcome: "valid", reason: "Ticket checked in" })

  return {
    ok: true,
    status: "new",
    ticket: {
      eventTitle: ticket.eventTitle ?? "Unknown event",
      tierName: ticket.isStaffTicket ? `Staff - ${ticket.staffRole ?? "Staff"}` : (ticket.tierName ?? "Ticket"),
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
