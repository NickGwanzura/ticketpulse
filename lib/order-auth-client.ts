"use client"
// A server-minted order capability, never a caller-supplied email, grants guest access.
const KEY = "tp_order_access_signatures"
const memory = new Map<string, string>()
function readMap(): Record<string, string> {
  try { return typeof window === "undefined" ? {} : JSON.parse(window.localStorage.getItem(KEY) ?? "{}") } catch { return {} }
}
export function rememberOrderAccess(orderId: string, signature?: string | null) {
  if (!orderId || !signature || !/^[a-f0-9]{64}$/i.test(signature)) return
  memory.set(orderId, signature)
  try { window.localStorage.setItem(KEY, JSON.stringify({ ...readMap(), [orderId]: signature })) } catch { /* memory fallback */ }
}
// Compatibility for existing contact-cache callers; emails grant no authority.
export function rememberOrderOwner(_orderId: string, _email?: string | null) { void _orderId; void _email; /* compatibility only */ }
export function orderAuthHeaders(orderId: string, signature?: string | null): Record<string, string> {
  const proof = signature || memory.get(orderId) || readMap()[orderId]
  return proof ? { "x-ticket-signature": proof } : {}
}
export function orderOwnerQuery(orderId: string, signature?: string | null): string {
  const proof = orderAuthHeaders(orderId, signature)["x-ticket-signature"]
  return proof ? "?sig=" + encodeURIComponent(proof) : ""
}
