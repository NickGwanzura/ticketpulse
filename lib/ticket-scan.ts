import { timingSafeEqual } from "node:crypto"
import { and, eq, isNull } from "drizzle-orm"

import { db } from "@/db"
import { events, orders, ticketScanLogs, tickets, ticketTiers } from "@/db/schema"
import { requireEventAccess } from "@/lib/event-access"
import { signTicketPayload } from "@/lib/tickets"

export type ScanResult =
  | { ok: true; status: "new" | "duplicate"; ticket: { eventTitle: string; tierName: string; holder?: string; isStaffTicket?: boolean; staffRole?: string; staffName?: string } }
  | { ok: false; error: string }

export type ScanContext = {
  eventId?: string | null
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
  orderStatus: "pending" | "awaiting_verification" | "paid" | "completed" | "cancelled" | "refunded" | "expired" | null
  eventStatus: "draft" | "pending_review" | "published" | "sold_out" | "cancelled" | "completed" | null
  eventStartsAt: Date | null
  eventEndsAt: Date | null
  tierName: string | null
  eventTitle: string | null
  isStaffTicket: boolean | null
  staffName: string | null
  staffRole: "security" | "usher" | "dj_sound" | "bar_staff" | "vip_host" | "media" | "other" | null
}

export async function markTicketScanned(rawCode: string, context: ScanContext = {}): Promise<ScanResult> {
  const code = rawCode.trim()
  if (!code) return { ok: false, error: "Empty code" }
  if (code.length > 2000) return { ok: false, error: "Code is too long" }

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
        orderStatus: orders.status,
        eventStatus: events.status,
        eventStartsAt: events.startsAt,
        eventEndsAt: events.endsAt,
        tierName: ticketTiers.name,
        eventTitle: events.title,
        isStaffTicket: tickets.isStaffTicket,
        staffName: tickets.staffName,
        staffRole: tickets.staffRole,
      })
      .from(tickets)
      .leftJoin(ticketTiers, eq(ticketTiers.id, tickets.tierId))
      .leftJoin(events, eq(events.id, tickets.eventId))
      .leftJoin(orders, eq(orders.id, tickets.orderId))
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

  if (context.eventId && ticket.eventId !== context.eventId) {
    await logScanAttempt({ ticket, outcome: "rejected", reason: "Ticket belongs to a different event" })
    return { ok: false, error: "This ticket belongs to a different event" }
  }

  if (ticket.eventId) {
    const access = await requireEventAccess(ticket.eventId)
    if (!access.allowed) {
      await logScanAttempt({ ticket, outcome: "unauthorized", reason: "Scanner is not authorized for this event" })
      return { ok: false, error: "You are not authorized to scan tickets for this event" }
    }
  }

  if (ticket.eventStatus === "cancelled") {
    const reason = "This event has been cancelled."
    await logScanAttempt({ ticket, outcome: "rejected", reason })
    return { ok: false, error: reason }
  }
  if (ticket.eventStatus === "draft" || ticket.eventStatus === "pending_review") {
    const reason = "This event is not live yet."
    await logScanAttempt({ ticket, outcome: "rejected", reason })
    return { ok: false, error: reason }
  }
  if (ticket.eventStatus === "completed" || (ticket.eventEndsAt && ticket.eventEndsAt.getTime() < Date.now())) {
    const reason = "This event has ended; entry is closed."
    await logScanAttempt({ ticket, outcome: "rejected", reason })
    return { ok: false, error: reason }
  }

  // A customer ticket is only valid after the associated order is paid. Staff
  // tickets are intentionally order-less and are validated by their ticket row.
  if (!ticket.isStaffTicket && ticket.orderStatus !== "paid" && ticket.orderStatus !== "completed") {
    const reason = "The order for this ticket is not paid."
    await logScanAttempt({ ticket, outcome: "rejected", reason })
    return { ok: false, error: reason }
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
    const signature = url.searchParams.get("sig")
    if (!match || !orderId || !signature || !/^[a-f0-9]{64}$/i.test(signature)) return null
    const expected = signTicketPayload(match[1], orderId)
    const actualBytes = Buffer.from(signature, "hex")
    const expectedBytes = Buffer.from(expected, "hex")
    if (actualBytes.length !== expectedBytes.length || !timingSafeEqual(actualBytes, expectedBytes)) return null
    return { ticketId: match[1], orderId }
  } catch {
    return null
  }
}
