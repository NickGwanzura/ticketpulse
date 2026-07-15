import "server-only"

/**
 * TicketPulse SMS Template Registry.
 *
 * VelocityAfrica's send-sms endpoint takes a plain message string (no
 * server-side template IDs), so templates are rendered to text locally.
 * `{{variable}}` placeholders in `body` are substituted from the `variables`
 * map passed to sendSms().
 */

interface SmsTemplateDef {
  variables: string[]
  description: string
  body: string
}

export const SMS_TEMPLATES = {
  TICKET_CONFIRMATION: {
    variables: [],
    description: "Ticket confirmation after successful purchase",
    body: "Your TicketPulse tickets are confirmed! Open your tickets and QR codes at ticketpulse.tech/orders and show them at the door. Need help? WhatsApp +263 788 689 923.",
  },
  EVENT_REMINDER_24H: {
    variables: [],
    description: "Reminder sent 24 hours before event",
    body: "Reminder from TicketPulse: your event is tomorrow! Access your tickets at ticketpulse.tech/orders and show the QR code at the door. See you there!",
  },
  TICKET_TRANSFER_RECEIVED: {
    variables: [],
    description: "Ticket transfer received notification",
    body: "Someone has sent you a ticket on TicketPulse! Check your email to claim it. Questions? WhatsApp +263 788 689 923.",
  },
  TICKETS_RESENT: {
    variables: [],
    description: "Tickets resent to customer email",
    body: "Your TicketPulse tickets have been resent to your email. You can also view them at ticketpulse.tech/orders. Show the QR code at the door.",
  },
} as const satisfies Record<string, SmsTemplateDef>

export type SmsTemplateName = keyof typeof SMS_TEMPLATES

/**
 * Render a template's body to the final message text, substituting any
 * `{{variable}}` placeholders from the given variables map.
 */
export function resolveTemplateBody(name: SmsTemplateName, variables: Record<string, string> = {}): string {
  const def = SMS_TEMPLATES[name]
  return def.body.replace(/\{\{(\w+)\}\}/g, (match, key: string) =>
    Object.prototype.hasOwnProperty.call(variables, key) ? variables[key] : match,
  )
}

export function isKnownTemplate(name: string): name is SmsTemplateName {
  return name in SMS_TEMPLATES
}
