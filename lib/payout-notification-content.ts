export type PayoutNotificationEvent =
  | "payout_requested"
  | "payout_approved"
  | "payout_processing"
  | "payout_rejected"
  | "payout_paid"
  | "payout_failed"

export type PayoutNotificationMessageInput = {
  eventType: PayoutNotificationEvent
  payoutId: string
  amount: string | number
  currency: string
  method: string
  rejectionReason?: string | null
  proofReference?: string | null
}

export function payoutNotificationMessage(input: PayoutNotificationMessageInput) {
  const amount = `${input.currency} ${Number(input.amount).toFixed(2)}`
  const method = input.method === "ecocash" ? "EcoCash" : input.method === "cash" ? "cash" : "bank transfer"
  const reference = input.payoutId.slice(0, 8)
  let subject: string
  let message: string

  switch (input.eventType) {
    case "payout_requested":
      subject = "Payout request received"
      message = `We received your payout request for ${amount} via ${method}. It is waiting for review.`
      break
    case "payout_approved":
      subject = "Payout approved"
      message = `Your payout request for ${amount} has been approved.`
      break
    case "payout_processing":
      subject = "Payout being processed"
      message = `Your payout of ${amount} via ${method} is now being processed.`
      break
    case "payout_rejected":
      subject = "Payout request update"
      message = `Your payout request for ${amount} was declined.${input.rejectionReason ? ` Reason: ${input.rejectionReason.trim().slice(0, 500)}` : ""}`
      break
    case "payout_paid":
      subject = "Payout sent"
      message = `Your payout of ${amount} via ${method} has been marked as paid.${input.proofReference ? ` Reference: ${input.proofReference.trim().slice(0, 120)}.` : ""}`
      break
    case "payout_failed":
      subject = "Payout could not be completed"
      message = `We could not complete your payout of ${amount}. Please contact TicketPulse support and quote reference ${reference}.`
      break
  }

  return { subject: `TicketPulse: ${subject}`, message, reference }
}

export const MAX_PAYOUT_NOTIFICATION_ATTEMPTS = 8
const RETRY_BASE_MS = 60_000
const RETRY_MAX_MS = 60 * 60_000

export function payoutNotificationRetryDelayMs(attemptCount: number) {
  const exponent = Math.max(0, Math.min(20, Math.floor(attemptCount) - 1))
  return Math.min(RETRY_MAX_MS, RETRY_BASE_MS * 2 ** exponent)
}
