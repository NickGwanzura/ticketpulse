export type BuyerOrderStatus = "paid" | "pending" | "completed" | "awaiting_verification" | "cancelled" | "refunded" | "expired" | "refund_processing" | "unknown"
export function buyerOrderStatus(status: string | null | undefined): BuyerOrderStatus {
  switch (status) {
    case "paid": case "pending": case "completed": case "awaiting_verification":
    case "cancelled": case "refunded": case "expired": case "refund_processing": return status
    default: return "unknown"
  }
}
export function isPaidOrder(status: string | null | undefined) { return status === "paid" || status === "completed" }
