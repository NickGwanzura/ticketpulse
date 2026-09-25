import { eq } from "drizzle-orm"
import { timingSafeEqual } from "crypto"

import { db } from "@/db"
import { orders, users } from "@/db/schema"
import { auth } from "@/auth"
import { signTicketPayload } from "@/lib/tickets"

/**
 * Authorization for endpoints that expose an order's tickets, QR codes, buyer
 * contact details, or that trigger sends.
 *
 * These URLs are reached by three populations, and a bare UUID is NOT
 * sufficient authority for any of them (the QR is a bearer admission
 * credential, and the payload includes PII):
 *
 *   1. Authenticated owner / admin  → session whose id or email matches the order
 *   2. Organizer of the order's event → scoped staff access
 *   3. Guest buyer with no account  → must prove possession of the signed
 *      ticket payload (`signTicketPayload`). The browser receives it at
 *      checkout and every emailed order link carries it. Knowing the buyer's
 *      email is NOT proof: emails are guessable and widely shared, and the QR
 *      is an admission credential.
 *
 * Callers pass whatever credentials they have; this helper decides.
 */
export type OrderAccessReason = "not_found" | "forbidden"

export type OrderAccessResult =
  | { ok: true; order: OrderAccessOrder }
  | { ok: false; reason: OrderAccessReason }

export type OrderAccessOrder = {
  id: string
  eventId: string
  userId: string | null
  guestEmail: string | null
  guestName: string | null
  buyerEmail: string | null
  status: string | null
}

export async function authorizeOrderAccess(
  orderId: string,
  creds: {
    /** Order or ticket signature from the buyer's link. */
    signature?: string | null
    /** Ticket id used with `signature`; defaults to the order id for order-level links. */
    ticketId?: string | null
    /** Already-resolved organizer scope, if the caller checked it. */
    organizerScoped?: boolean
  } = {},
): Promise<OrderAccessResult> {
  const [order] = await db
    .select({
      id: orders.id,
      eventId: orders.eventId,
      userId: orders.userId,
      guestEmail: orders.guestEmail,
      guestName: orders.guestName,
      status: orders.status,
      buyerEmail: users.email,
    })
    .from(orders)
    .leftJoin(users, eq(users.id, orders.userId))
    .where(eq(orders.id, orderId))
    .limit(1)

  if (!order) return { ok: false, reason: "not_found" }

  // Organizer staff access — the caller has already applied an event-scoped
  // predicate, so reaching this point means the order is in their scope.
  if (creds.organizerScoped) return { ok: true, order }

  // Signed ticket payload — proves possession of the buyer's ticket link.
  if (creds.signature && /^[a-f0-9]{64}$/i.test(creds.signature)) {
    const expected = signTicketPayload(creds.ticketId ?? order.id, order.id)
    const a = Buffer.from(creds.signature, "hex")
    const b = Buffer.from(expected, "hex")
    if (a.length === b.length && timingSafeEqual(a, b)) return { ok: true, order }
  }

  const session = await auth()
  const sessionUserId = session?.user?.id
  if (sessionUserId) {
    if (session.user.role === "admin") return { ok: true, order }
    if (order.userId && order.userId === sessionUserId) return { ok: true, order }
    const sessionEmail = session.user.email?.toLowerCase()
    if (sessionEmail) {
      const ownerEmails = [order.guestEmail, order.buyerEmail]
        .filter(Boolean)
        .map((e) => e!.toLowerCase())
      if (ownerEmails.includes(sessionEmail)) return { ok: true, order }
    }
  }

  return { ok: false, reason: "forbidden" }
}

/** Extract caller credentials from headers/query shared by the order routes. */
export function orderAccessCredsFrom(req: Request): {
  signature: string | null
  ticketId: string | null
} {
  const url = new URL(req.url)
  return {
    signature: req.headers.get("x-ticket-signature") ?? url.searchParams.get("sig"),
    ticketId: url.searchParams.get("ticketId"),
  }
}
