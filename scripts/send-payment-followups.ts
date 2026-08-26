/**
 * Send one recovery email per buyer for unpaid Visa/EcoCash attempts in the
 * last 72 hours.
 *
 * Preview (default): npx tsx scripts/send-payment-followups.ts
 * Send:             npx tsx scripts/send-payment-followups.ts --send
 */

import dotenv from "dotenv"
import { Pool } from "pg"
import { Resend } from "resend"

dotenv.config({ path: ".env.local" })

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://ticketpulse.tech"
const FROM = "TicketPulse <no-reply@ticketpulse.tech>"
const SEND = process.argv.includes("--send")

type Attempt = {
  id: string
  status: string | null
  payment_method: string | null
  guest_name: string | null
  guest_email: string
  total_amount: string | null
  currency: string | null
  created_at: Date | string
  event_title: string | null
  event_slug: string | null
  metadata: Record<string, unknown> | null
}

type Recipient = {
  email: string
  name: string | null
  attempts: Attempt[]
}

function esc(value: unknown): string {
  return String(value ?? "").replace(/[<>&"']/g, (char) => ({
    "<": "&lt;",
    ">": "&gt;",
    "&": "&amp;",
    '"': "&quot;",
    "'": "&#39;",
  })[char] ?? char)
}

function orderLink(attempt: Attempt): string {
  return attempt.event_slug
    ? `${APP_URL}/events/${encodeURIComponent(attempt.event_slug)}`
    : `${APP_URL}/orders/${encodeURIComponent(attempt.id)}`
}

function paymentLabel(method: string | null): string {
  return method === "velocity-ecocash" || method === "ecocash" ? "EcoCash" : "Visa/Mastercard"
}

function buildEmail(recipient: Recipient): { subject: string; html: string; text: string } {
  const firstName = recipient.name?.trim().split(/\s+/)[0] || "there"
  const items = recipient.attempts.map((attempt) => {
    const label = attempt.event_title ?? "your event"
    const amount = attempt.total_amount ? `${attempt.total_amount} ${attempt.currency ?? "USD"}` : ""
    return `<li style="margin:0 0 8px"><a href="${esc(orderLink(attempt))}" style="color:#0B1F4A;font-weight:600">${esc(label)}</a>${amount ? ` — ${esc(amount)}` : ""} (${esc(paymentLabel(attempt.payment_method))})</li>`
  }).join("")
  const textItems = recipient.attempts.map((attempt) => {
    const amount = attempt.total_amount ? ` — ${attempt.total_amount} ${attempt.currency ?? "USD"}` : ""
    return `- ${attempt.event_title ?? "your event"}${amount} (${paymentLabel(attempt.payment_method)}): ${orderLink(attempt)}`
  }).join("\n")

  return {
    subject: "You can retry your TicketPulse payment",
    html: `<!doctype html><html><body style="margin:0;background:#F6F9FC;font-family:Arial,sans-serif;color:#0B1220"><div style="max-width:580px;margin:32px auto;background:#fff;border:1px solid #E6ECF2;border-radius:16px;padding:28px"><p style="font-weight:700;font-size:18px;margin:0 0 22px">TicketPulse</p><h1 style="font-size:23px;margin:0 0 18px">Your payment is ready to retry</h1><p>Hi ${esc(firstName)},</p><p>We noticed that a TicketPulse payment attempt from the last 72 hours did not complete.</p><p><strong>Visa and Mastercard checkout is stable again now.</strong> You can retry securely, and EcoCash is also available if you prefer it.</p><p>No ticket is issued until payment completes. Your attempt${recipient.attempts.length === 1 ? " was" : "s were"}:</p><ul style="padding-left:20px">${items}</ul><p style="margin-top:24px">Please start a fresh checkout from the event link above. If you already completed payment elsewhere, you can ignore this message.</p><p>Thanks,<br><strong>The TicketPulse team</strong></p></div></body></html>`,
    text: `Hi ${firstName},\n\nWe noticed that a TicketPulse payment attempt from the last 72 hours did not complete.\n\nVisa and Mastercard checkout is stable again now. You can retry securely, and EcoCash is also available.\n\nYour attempt${recipient.attempts.length === 1 ? " was" : "s were"}:\n${textItems}\n\nPlease start a fresh checkout from the event link. If you already completed payment elsewhere, you can ignore this message.\n\nThanks,\nThe TicketPulse team`,
  }
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) throw new Error("DATABASE_URL is not set")
  if (SEND && !process.env.AUTH_RESEND_KEY) throw new Error("AUTH_RESEND_KEY is not set")

  const pool = new Pool({ connectionString: databaseUrl, max: 2, connectionTimeoutMillis: 10_000 })
  try {
    const { rows } = await pool.query<Attempt>(`
      SELECT o.id, o.status, o.payment_method, o.guest_name, o.guest_email,
             o.total_amount, o.currency, o.created_at, o.metadata,
             e.title AS event_title, e.slug AS event_slug
      FROM orders o
      LEFT JOIN events e ON e.id = o.event_id
      WHERE o.created_at >= NOW() - INTERVAL '72 hours'
        AND o.guest_email IS NOT NULL
        AND LOWER(COALESCE(o.payment_method, '')) IN
            ('velocity-card', 'velocity-ecocash', 'visa', 'ecocash', 'vmc')
        AND COALESCE(o.status, '') NOT IN ('paid', 'completed', 'refunded')
      ORDER BY o.created_at DESC
    `)

    const recipients = new Map<string, Recipient>()
    for (const attempt of rows) {
      const email = attempt.guest_email.trim().toLowerCase()
      if (!email || attempt.metadata?.paymentFollowupSentAt) continue
      const existing = recipients.get(email) ?? { email, name: attempt.guest_name, attempts: [] }
      existing.attempts.push(attempt)
      recipients.set(email, existing)
    }

    console.log(`${SEND ? "Sending" : "Would send"} ${recipients.size} buyer follow-up email(s) for ${rows.length} qualifying attempt(s).`)
    for (const recipient of recipients.values()) {
      console.log(`- ${recipient.email}: ${recipient.attempts.map((attempt) => attempt.id.slice(0, 8)).join(", ")}`)
    }
    if (!SEND || recipients.size === 0) return

    const resend = new Resend(process.env.AUTH_RESEND_KEY)
    let sent = 0
    let failed = 0
    for (const recipient of recipients.values()) {
      const email = buildEmail(recipient)
      try {
        const result = await resend.emails.send({ from: FROM, to: [recipient.email], subject: email.subject, html: email.html, text: email.text })
        if (result.error) throw new Error(result.error.message ?? "Resend rejected email")
        const ids = recipient.attempts.map((attempt) => attempt.id)
        await pool.query(
          `UPDATE orders
           SET metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{paymentFollowupSentAt}', to_jsonb($1::text), true),
               updated_at = NOW()
           WHERE id = ANY($2::uuid[])`,
          [new Date().toISOString(), ids],
        )
        sent++
        console.log(`sent ${recipient.email}`)
      } catch (error) {
        failed++
        console.error(`failed ${recipient.email}: ${error instanceof Error ? error.message : String(error)}`)
      }
    }
    console.log(`Done. Sent: ${sent}; failed: ${failed}`)
  } finally {
    await pool.end()
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
