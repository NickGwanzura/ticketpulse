import "server-only"

/**
 * TicketPulse SMS Template Registry.
 *
 * Each template must be submitted to VelocityAfrica for approval before use.
 * Template IDs are configurable via env vars with numeric fallback defaults.
 */

interface SmsTemplateDef {
  templateId: number | (() => number)
  variables: string[]
  description: string
}

function templateId(envVar: string, fallback: number): number {
  const val = process.env[envVar]
  if (!val) return fallback
  const n = Number(val)
  return Number.isInteger(n) && n > 0 ? n : fallback
}

export const SMS_TEMPLATES = {
  TICKET_CONFIRMATION: {
    templateId: () => templateId("VA_SMS_TEMPLATE_TICKET", 1),
    variables: [],
    description: "Ticket confirmation after successful purchase",
    body: "Your TicketPulse tickets are confirmed! Open your tickets and QR codes at ticketpulse.tech/orders and show them at the door. Need help? WhatsApp +263 788 689 923.",
  },
  EVENT_REMINDER_24H: {
    templateId: () => templateId("VA_SMS_TEMPLATE_REMINDER", 2),
    variables: [],
    description: "Reminder sent 24 hours before event",
    body: "Reminder from TicketPulse: your event is tomorrow! Access your tickets at ticketpulse.tech/orders and show the QR code at the door. See you there!",
  },
  TICKET_TRANSFER_RECEIVED: {
    templateId: () => templateId("VA_SMS_TEMPLATE_TRANSFER", 3),
    variables: [],
    description: "Ticket transfer received notification",
    body: "Someone has sent you a ticket on TicketPulse! Check your email to claim it. Questions? WhatsApp +263 788 689 923.",
  },
  TICKETS_RESENT: {
    templateId: () => templateId("VA_SMS_TEMPLATE_RESEND", 4),
    variables: [],
    description: "Tickets resent to customer email",
    body: "Your TicketPulse tickets have been resent to your email. You can also view them at ticketpulse.tech/orders. Show the QR code at the door.",
  },
} as const

export type SmsTemplateName = keyof typeof SMS_TEMPLATES

export function resolveTemplateId(name: SmsTemplateName): number {
  const def = SMS_TEMPLATES[name]
  const id = typeof def.templateId === "function" ? def.templateId() : def.templateId
  return id
}

export function isKnownTemplate(name: string): name is SmsTemplateName {
  return name in SMS_TEMPLATES
}
