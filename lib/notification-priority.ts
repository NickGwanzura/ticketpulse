import type { notifications } from "@/db/schema"

type NotificationType = (typeof notifications.$inferInsert)["type"]
export type NotificationPriority = "low" | "normal" | "high"

/**
 * Default priority by notification type — before this every notification
 * looked identical in the bell regardless of whether it was "your payout
 * failed" or "your event was published." High = needs action or signals a
 * problem; normal = routine confirmation; low = informational only.
 */
const PRIORITY_BY_TYPE: Partial<Record<NotificationType, NotificationPriority>> = {
  payout_failed: "high",
  payout_rejected: "high",
  order_refunded: "high",
  payout_paid: "normal",
  payout_approved: "normal",
  payout_requested: "normal",
  order_paid: "normal",
  ticket_issued: "normal",
  order_cancelled: "normal",
  ticket_checked_in: "low",
  event_published: "low",
  event_sold_out: "normal",
  system: "low",
}

export function defaultNotificationPriority(type: NotificationType): NotificationPriority {
  return PRIORITY_BY_TYPE[type] ?? "normal"
}
