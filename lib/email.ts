import "server-only"
import { Resend } from "resend"
import { log } from "@/lib/logger"
import WelcomeEmail from "@/emails/welcome"
import MagicLinkEmail from "@/emails/magic-link"
import OrderConfirmationEmail, { type OrderLine } from "@/emails/order-confirmation"
import EventReminderEmail from "@/emails/event-reminder"
import PayoutNotificationEmail from "@/emails/payout-notification"
import VerifyPurchaseEmail from "@/emails/verify-purchase"
import AdminInviteEmail from "@/emails/admin-invite"
import ResetPasswordEmail from "@/emails/reset-password"

const FROM = "TicketPulse <no-reply@ticketpulse.tech>"
const ADMIN = process.env.ADMIN_EMAIL ?? "nick@ticketpulse.tech"

export function validateEmailConfig(): { valid: boolean; warnings: string[] } {
  const warnings: string[] = []

  if (!process.env.AUTH_RESEND_KEY) {
    warnings.push("AUTH_RESEND_KEY is not set — transactional email will be skipped")
  }

  const domain = FROM.split("@").pop()?.replace(">", "")
  if (domain && !domain.includes("gmail.com") && !domain.includes("localhost")) {
    warnings.push(
      `Resend sending domain "${domain}" must be verified in Resend dashboard before going live, ` +
      "otherwise outbound mail will be rejected or marked as spam",
    )
  }

  if (warnings.length > 0) {
    for (const w of warnings) {
      log.warn(`email config validation: ${w}`)
    }
  }

  return { valid: warnings.length === 0, warnings }
}

let _resend: Resend | null = null
function client(): Resend | null {
  const key = process.env.AUTH_RESEND_KEY
  if (!key) {
    // In production, refuse to silently no-op — transactional mail is too
    // important to fail invisibly. Dev/test can still skip.
    if (process.env.NODE_ENV === "production") {
      throw new Error("AUTH_RESEND_KEY is not set — refusing to send mail in production")
    }
    console.warn("[email] AUTH_RESEND_KEY not set — skipping send")
    log.warn("email — AUTH_RESEND_KEY not set, skipping send")
    return null
  }
  if (!_resend) _resend = new Resend(key)
  return _resend
}

type SendResult = { id: string } | { skipped: true; reason: string }

type Attachment = { filename: string; content: Buffer | string; contentType?: string }

async function send(args: {
  to: string
  subject: string
  react: React.ReactElement
  attachments?: Attachment[]
}): Promise<SendResult> {
  const resend = client()
  if (!resend) return { skipped: true, reason: "AUTH_RESEND_KEY not set" }
  const { data, error } = await resend.emails.send({
    from: FROM,
    to: args.to,
    subject: args.subject,
    react: args.react,
    attachments: args.attachments?.map((a) => ({
      filename: a.filename,
      content: a.content instanceof Buffer ? a.content.toString("base64") : a.content,
      contentType: a.contentType ?? "application/pdf",
    })),
  })
  if (error) {
    console.error("[email] Resend rejected send", { to: args.to, subject: args.subject, error })
    log.error("email — Resend rejected send", { to: args.to, subject: args.subject, error: error.message })
    throw new Error(error.message ?? "Resend send failed")
  }
  return { id: data?.id ?? "" }
}

/**
 * Generic transactional send — accepts pre-rendered HTML/text. Used by the
 * plain-HTML templates in `@/lib/email-templates`. Throws on Resend error.
 */
export async function sendEmail(opts: {
  to: string | string[]
  subject: string
  html: string
  text?: string
  replyTo?: string
  cc?: string | string[]
  attachments?: { filename: string; content: Buffer | string; contentType?: string }[]
}): Promise<SendResult> {
  const resend = client()
  if (!resend) return { skipped: true, reason: "AUTH_RESEND_KEY not set" }
  const { data, error } = await resend.emails.send({
    from: FROM,
    to: Array.isArray(opts.to) ? opts.to : [opts.to],
    cc: opts.cc,
    subject: opts.subject,
    html: opts.html,
    text: opts.text,
    replyTo: opts.replyTo,
    attachments: opts.attachments?.map((a) => ({
      filename: a.filename,
      content: a.content instanceof Buffer ? a.content.toString("base64") : a.content,
      contentType: a.contentType ?? "application/pdf",
    })),
  })
  if (error) {
    console.error("[email] Resend rejected send", { to: opts.to, subject: opts.subject, error })
    log.error("email — Resend rejected send", { to: opts.to, subject: opts.subject, error: error.message })
    throw new Error(error.message ?? "Resend send failed")
  }
  return { id: data?.id ?? "" }
}

/** Resend hard limit per batch.send() call */
const BATCH_SIZE = 100

/**
 * Send up to thousands of emails via Resend's batch API.
 * Automatically chunks into groups of 100 (Resend max per request).
 * Returns counts of sent and failed emails.
 */
export async function sendBatchEmails(emails: {
  to: string
  subject: string
  html: string
  text?: string
}[]): Promise<{ sent: number; failed: number }> {
  const resend = client()
  if (!resend) return { sent: 0, failed: emails.length }

  let sent = 0
  let failed = 0

  for (let i = 0; i < emails.length; i += BATCH_SIZE) {
    const chunk = emails.slice(i, i + BATCH_SIZE)
    const payload = chunk.map((e) => ({
      from: FROM,
      to: [e.to],
      subject: e.subject,
      html: e.html,
      ...(e.text ? { text: e.text } : {}),
    }))

    try {
      const { error } = await resend.batch.send(payload)
      if (error) {
        console.error("[email] batch send error", error)
        log.error("email — batch send error", { error: (error as { message?: string }).message })
        failed += chunk.length
      } else {
        sent += chunk.length
      }
    } catch (err) {
      console.error("[email] batch send threw", err)
      failed += chunk.length
    }

    // Brief pause between batch chunks to stay within rate limits
    if (i + BATCH_SIZE < emails.length) {
      await new Promise((r) => setTimeout(r, 200))
    }
  }

  return { sent, failed }
}

export const adminEmail = ADMIN

export function sendWelcomeEmail(args: { to: string; name?: string | null }) {
  return send({
    to: args.to,
    subject: "Welcome to TicketPulse",
    react: WelcomeEmail({ name: args.name }),
  })
}

export function sendMagicLinkEmail(args: { to: string; url: string; host?: string }) {
  return send({
    to: args.to,
    subject: "Your TicketPulse sign-in link",
    react: MagicLinkEmail({ url: args.url, host: args.host }),
  })
}

export function sendPurchaseVerificationEmail(args: {
  to: string
  url: string
  eventTitle: string
  amount: string
  currency: string
  expiresInHours?: number
}) {
  return send({
    to: args.to,
    subject: `Confirm to receive your tickets: ${args.eventTitle}`,
    react: VerifyPurchaseEmail({
      url: args.url,
      eventTitle: args.eventTitle,
      amount: args.amount,
      currency: args.currency,
      expiresInHours: args.expiresInHours,
    }),
  })
}

export function sendPasswordResetEmail(args: {
  to: string
  name?: string | null
  resetUrl: string
}) {
  return send({
    to: args.to,
    subject: "Reset your TicketPulse password",
    react: ResetPasswordEmail({ name: args.name, resetUrl: args.resetUrl }),
  })
}

export function sendAdminInviteEmail(args: {
  to: string
  role: string
  inviteUrl: string
  inviterName?: string | null
}) {
  return send({
    to: args.to,
    subject: "You’re invited to TicketPulse",
    react: AdminInviteEmail({
      role: args.role,
      inviteUrl: args.inviteUrl,
      inviterName: args.inviterName,
    }),
  })
}

export function sendOrderConfirmationEmail(args: {
  to: string
  buyerName?: string | null
  orderId: string
  eventTitle: string
  eventDate: string
  eventVenue?: string
  lines: OrderLine[]
  total: string
  currency: string
  ticketUrl: string
  attachments?: { filename: string; content: Buffer | string; contentType?: string }[]
}) {
  return send({
    to: args.to,
    subject: `Tickets confirmed: ${args.eventTitle}`,
    react: OrderConfirmationEmail(args),
    attachments: args.attachments,
  })
}

export function sendPayoutNotificationEmail(args: {
  to: string
  organizerName?: string | null
  payoutId: string
  amount: string
  currency: string
  method: string
  destination: string
  eventTitle: string
}) {
  return send({
    to: args.to,
    subject: `Payout sent: ${args.amount} ${args.currency}`,
    react: PayoutNotificationEmail(args),
  })
}

export function sendEventReminderEmail(args: {
  to: string
  buyerName?: string | null
  eventTitle: string
  eventDate: string
  eventVenue?: string
  ticketUrl: string
}) {
  return send({
    to: args.to,
    subject: `⏰ Reminder: ${args.eventTitle} is tomorrow!`,
    react: EventReminderEmail(args),
  })
}
