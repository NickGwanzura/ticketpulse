/**
 * VelocityAfrica SMS Templates
 *
 * Each template must be submitted to VelocityAfrica for approval before use.
 * Once approved, VelocityAfrica assigns a numeric templateId. Update the
 * constants below with the assigned IDs, then set the matching env vars.
 *
 * SUBMISSION CHECKLIST
 * ─────────────────────────────────────────────────────────────────────────────
 * Submit the template texts below (exactly as written) to VelocityAfrica
 * for approval. Record the assigned templateId for each one.
 *
 * ┌─────────────────────────────┬────────────────┬──────────────────────────────┐
 * │ Template                    │ ENV VAR                       │ Fallback ID │
 * ├─────────────────────────────┼──────────────────────────────┼─────────────┤
 * │ Ticket confirmation         │ VA_SMS_TEMPLATE_TICKET        │ 1           │
 * │ Event reminder (24 h)       │ VA_SMS_TEMPLATE_REMINDER      │ 2           │
 * │ Ticket transfer received    │ VA_SMS_TEMPLATE_TRANSFER      │ 3           │
 * │ Tickets resent              │ VA_SMS_TEMPLATE_RESEND        │ 4           │
 * └─────────────────────────────┴──────────────────────────────┴─────────────┘
 *
 * ═════════════════════════════════════════════════════════════════════════════
 * TEMPLATE 1 — Ticket Confirmation
 * Sent immediately after a successful purchase.
 * ─────────────────────────────────────────────────────────────────────────────
 * Your TicketPulse tickets are confirmed! Open your tickets and QR codes at
 * ticketpulse.tech/orders and show them at the door. Need help? WhatsApp
 * +263 788 689 923.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * TEMPLATE 2 — Event Reminder (24 h before)
 * Sent ~24 hours before the event starts.
 * ─────────────────────────────────────────────────────────────────────────────
 * Reminder from TicketPulse: your event is tomorrow! Access your tickets at
 * ticketpulse.tech/orders and show the QR code at the door. See you there!
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * TEMPLATE 3 — Ticket Transfer Received
 * Sent to the recipient when someone initiates a ticket transfer to them.
 * ─────────────────────────────────────────────────────────────────────────────
 * Someone has sent you a ticket on TicketPulse! Check your email to claim it.
 * Questions? WhatsApp +263 788 689 923.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * TEMPLATE 4 — Tickets Resent
 * Sent when a buyer requests their tickets to be resent.
 * ─────────────────────────────────────────────────────────────────────────────
 * Your TicketPulse tickets have been resent to your email. You can also view
 * them at ticketpulse.tech/orders. Show the QR code at the door.
 * ─────────────────────────────────────────────────────────────────────────────
 */

function templateId(envVar: string, fallback: number): number {
  const val = process.env[envVar]
  if (!val) return fallback
  const n = Number(val)
  return Number.isInteger(n) && n > 0 ? n : fallback
}

export const SMS_TEMPLATE = {
  /** Sent immediately after a successful purchase. */
  TICKET_CONFIRMATION: () => templateId("VA_SMS_TEMPLATE_TICKET", 1),

  /** Sent ~24 hours before the event starts. */
  EVENT_REMINDER: () => templateId("VA_SMS_TEMPLATE_REMINDER", 2),

  /** Sent to the recipient when someone initiates a ticket transfer to them. */
  TICKET_TRANSFER: () => templateId("VA_SMS_TEMPLATE_TRANSFER", 3),

  /** Sent when a buyer requests their tickets to be resent. */
  TICKETS_RESENT: () => templateId("VA_SMS_TEMPLATE_RESEND", 4),
} as const
