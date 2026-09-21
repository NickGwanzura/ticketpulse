"use client"

/**
 * Client-side proof-of-ownership for order endpoints.
 *
 * The order QR codes and buyer details are authority-bearing, so
 * `/api/orders/[id]/*` requires the caller to prove they own the order
 * (see lib/order-access.ts). Guests have no session, so the proof is the
 * email the order was placed with — the same address the confirmation mail
 * went to and the one `/orders/lookup` already accepts as ownership.
 *
 * The buyer's email is remembered at checkout (and re-remembered whenever an
 * order payload is loaded here), so subsequent fetches on this device carry it
 * automatically. An authenticated owner needs no header at all — the session
 * satisfies the server-side check.
 */

const KEY = "tp_order_owner_emails"

function readMap(): Record<string, string> {
  if (typeof window === "undefined") return {}
  try {
    return JSON.parse(window.localStorage.getItem(KEY) ?? "{}") as Record<string, string>
  } catch {
    return {}
  }
}

/** Remember which email belongs to an order, so later fetches can prove it. */
export function rememberOrderOwner(orderId: string, email: string | null | undefined) {
  if (typeof window === "undefined" || !orderId || !email) return
  try {
    const map = readMap()
    map[orderId] = email.trim().toLowerCase()
    window.localStorage.setItem(KEY, JSON.stringify(map))
  } catch {
    /* storage unavailable — fetches will fall back to the session */
  }
}

/** Headers proving ownership of `orderId`, or empty when unknown. */
export function orderAuthHeaders(orderId: string, signature?: string | null): Record<string, string> {
  if (signature) return { "x-ticket-signature": signature }
  const email = readMap()[orderId]
  return email ? { "x-order-email": email } : {}
}

/**
 * Same proof as a query string, for plain `<a href>` links (e.g. the Apple
 * Wallet pass download) that cannot set request headers.
 */
export function orderOwnerQuery(orderId: string, signature?: string | null): string {
  if (signature) return `?sig=${encodeURIComponent(signature)}`
  const email = readMap()[orderId]
  return email ? `?email=${encodeURIComponent(email)}` : ""
}
