"use client"

/**
 * Client-side proof-of-ownership for order endpoints.
 *
 * The order QR codes and buyer details are authority-bearing, so
 * `/api/orders/[id]/*` requires the caller to prove they own the order
 * (see lib/order-access.ts). Guests have no session, so the proof is the
 * order's access signature: the checkout API returns it when the order is
 * created, and every emailed order link carries it as `?sig=`.
 *
 * The signature is remembered per order on this device, so later fetches carry
 * it automatically. An authenticated owner needs no header at all — the
 * session satisfies the server-side check.
 */

const KEY = "tp_order_access"
const SIG_RE = /^[a-f0-9]{64}$/i

function readMap(): Record<string, string> {
  if (typeof window === "undefined") return {}
  try {
    return JSON.parse(window.localStorage.getItem(KEY) ?? "{}") as Record<string, string>
  } catch {
    return {}
  }
}

/** Remember an order's access signature so later fetches can prove ownership. */
export function rememberOrderAccess(orderId: string, signature: string | null | undefined) {
  if (typeof window === "undefined" || !orderId || !signature || !SIG_RE.test(signature)) return
  try {
    const map = readMap()
    map[orderId] = signature
    window.localStorage.setItem(KEY, JSON.stringify(map))
  } catch {
    /* storage unavailable — fetches will fall back to the session */
  }
}

/** The best known signature for `orderId`: an explicit one (from the URL) wins. */
export function orderAccessSignatureFor(orderId: string, signature?: string | null): string | null {
  if (signature && SIG_RE.test(signature)) return signature
  return readMap()[orderId] ?? null
}

/** Headers proving ownership of `orderId`, or empty when unknown. */
export function orderAuthHeaders(orderId: string, signature?: string | null): Record<string, string> {
  const sig = orderAccessSignatureFor(orderId, signature)
  return sig ? { "x-ticket-signature": sig } : {}
}

/**
 * Same proof as a query string, for plain `<a href>` links (e.g. the Apple
 * Wallet pass download) that cannot set request headers.
 */
export function orderOwnerQuery(orderId: string, signature?: string | null): string {
  const sig = orderAccessSignatureFor(orderId, signature)
  return sig ? `?sig=${encodeURIComponent(sig)}` : ""
}
