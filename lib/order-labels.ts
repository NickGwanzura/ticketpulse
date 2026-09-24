import type { OrderRecord } from "@/lib/cart-context"

/** Buyer-facing wording for order statuses and payment methods. */

export const ORDER_STATUS_LABEL: Record<OrderRecord["status"], string> = {
  paid: "Paid",
  completed: "Paid",
  pending: "Awaiting payment",
  refunded: "Refunded",
  expired: "Not completed",
}

export const ORDER_STATUS_TONE: Record<OrderRecord["status"], string> = {
  paid: "bg-green-50 text-green-700",
  completed: "bg-green-50 text-green-700",
  pending: "bg-amber-50 text-amber-700",
  refunded: "bg-rose-50 text-rose-700",
  expired: "bg-paper-2 text-ink-3",
}

export function paymentMethodLabel(method: string | null | undefined): string {
  const m = (method ?? "").toLowerCase()
  if (m.includes("ecocash")) return "EcoCash"
  if (m.includes("card") || m === "vmc" || m.includes("visa")) return "Visa / Mastercard"
  if (m === "free") return "Free"
  if (m.includes("cash")) return "Cash"
  return "—"
}

export function isOrderPaid(status: OrderRecord["status"] | undefined): boolean {
  return status === "paid" || status === "completed"
}

export const SUPPORT_WHATSAPP = "263788689923"
