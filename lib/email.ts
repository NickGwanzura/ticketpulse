import "server-only"
import { Resend } from "resend"
import WelcomeEmail from "@/emails/welcome"
import MagicLinkEmail from "@/emails/magic-link"
import OrderConfirmationEmail, { type OrderLine } from "@/emails/order-confirmation"
import PayoutNotificationEmail from "@/emails/payout-notification"
import VerifyPurchaseEmail from "@/emails/verify-purchase"
import AdminInviteEmail from "@/emails/admin-invite"
import ResetPasswordEmail from "@/emails/reset-password"

// TODO: verify the `ticketpulse.tech` sending domain in Resend before
// going live, otherwise outbound mail will be rejected.
const FROM = "TicketPulse <no-reply@ticketpulse.tech>"
const ADMIN = process.env.ADMIN_EMAIL ?? "nick@ticketpulse.tech"

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
    return null
  }
  if (!_resend) _resend = new Resend(key)
  return _resend
}

type SendResult = { id: string } | { skipped: true; reason: string }

async function send(args: {
  to: string
  subject: string
  react: React.ReactElement
}): Promise<SendResult> {
  const resend = client()
  if (!resend) return { skipped: true, reason: "AUTH_RESEND_KEY not set" }
  const { data, error } = await resend.emails.send({
    from: FROM,
    to: args.to,
    subject: args.subject,
    react: args.react,
  })
  if (error) {
    console.error("[email] Resend rejected send", { to: args.to, subject: args.subject, error })
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
  })
  if (error) {
    console.error("[email] Resend rejected send", { to: opts.to, subject: opts.subject, error })
    throw new Error(error.message ?? "Resend send failed")
  }
  return { id: data?.id ?? "" }
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
}) {
  return send({
    to: args.to,
    subject: `Tickets confirmed: ${args.eventTitle}`,
    react: OrderConfirmationEmail(args),
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
