import { and, eq, gte, inArray, isNotNull, sql } from "drizzle-orm"
import { NextResponse } from "next/server"

import { db } from "@/db"
import { events, orders } from "@/db/schema"
import { verifyCronSecret } from "@/lib/cron-auth"
import { sendEmail } from "@/lib/email"
import { log } from "@/lib/logger"
import { acquireLock, releaseLock } from "@/lib/velocity/idempotency"

const PAYMENT_METHODS = ["velocity-card", "velocity-ecocash", "visa", "ecocash", "vmc"]
const FINAL_STATUSES = ["paid", "completed", "refunded"]
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://ticketpulse.tech"

type FollowupOrder = {
  id: string
  status: string | null
  paymentMethod: string | null
  guestName: string | null
  guestEmail: string
  totalAmount: string | null
  currency: string | null
  eventId: string
  eventTitle: string | null
  eventSlug: string | null
  metadata: unknown
}

type Recipient = { email: string; name: string | null; orders: FollowupOrder[] }

function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(/[<>&"']/g, (char) => ({
    "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&#39;",
  })[char] ?? char)
}

function paymentLabel(method: string | null): string {
  return method === "velocity-ecocash" || method === "ecocash" ? "EcoCash" : "Visa/Mastercard"
}

function eventUrl(order: FollowupOrder): string {
  return order.eventSlug
    ? `${APP_URL}/events/${encodeURIComponent(order.eventSlug)}`
    : `${APP_URL}/orders/${encodeURIComponent(order.id)}`
}

function emailContent(recipient: Recipient) {
  const firstName = recipient.name?.trim().split(/\s+/)[0] || "there"
  const htmlOrders = recipient.orders.map((order) => {
    const amount = order.totalAmount ? ` — ${order.totalAmount} ${order.currency ?? "USD"}` : ""
    return `<li><a href="${escapeHtml(eventUrl(order))}" style="color:#0B1F4A;font-weight:600">${escapeHtml(order.eventTitle ?? "your event")}</a>${escapeHtml(amount)} (${escapeHtml(paymentLabel(order.paymentMethod))})</li>`
  }).join("")
  const textOrders = recipient.orders.map((order) => {
    const amount = order.totalAmount ? ` — ${order.totalAmount} ${order.currency ?? "USD"}` : ""
    return `- ${order.eventTitle ?? "your event"}${amount} (${paymentLabel(order.paymentMethod)}): ${eventUrl(order)}`
  }).join("\n")

  return {
    subject: "You can retry your TicketPulse payment",
    html: `<div style="max-width:580px;margin:32px auto;background:#fff;border:1px solid #E6ECF2;border-radius:16px;padding:28px;font-family:Arial,sans-serif;color:#0B1220"><p style="font-weight:700;font-size:18px">TicketPulse</p><h1 style="font-size:23px">Your payment is ready to retry</h1><p>Hi ${escapeHtml(firstName)},</p><p>We noticed that a TicketPulse payment attempt from the last 72 hours did not complete.</p><p><strong>Visa and Mastercard checkout is stable again now.</strong> You can retry securely, and EcoCash is also available if you prefer it.</p><p>No ticket is issued until payment completes. Your attempt${recipient.orders.length === 1 ? " was" : "s were"}:</p><ul>${htmlOrders}</ul><p>Please start a fresh checkout from the event link above. If you already completed payment elsewhere, you can ignore this message.</p><p>Thanks,<br><strong>The TicketPulse team</strong></p></div>`,
    text: `Hi ${firstName},\n\nWe noticed that a TicketPulse payment attempt from the last 72 hours did not complete.\n\nVisa and Mastercard checkout is stable again now. You can retry securely, and EcoCash is also available.\n\nYour attempt${recipient.orders.length === 1 ? " was" : "s were"}:\n${textOrders}\n\nPlease start a fresh checkout from the event link. If you already completed payment elsewhere, you can ignore this message.\n\nThanks,\nThe TicketPulse team`,
  }
}

export async function POST(request: Request) {
  const authError = verifyCronSecret(request)
  if (authError) return authError

  const lockKey = "payment-followups:72-hour"
  if (!await acquireLock(lockKey)) {
    return NextResponse.json({ sent: 0, failed: 0, locked: true })
  }

  try {
    const since = new Date(Date.now() - 72 * 60 * 60 * 1000)
    const rows = await db
    .select({
      id: orders.id,
      status: orders.status,
      paymentMethod: orders.paymentMethod,
      guestName: orders.guestName,
      guestEmail: orders.guestEmail,
      totalAmount: orders.totalAmount,
      currency: orders.currency,
      eventId: orders.eventId,
      eventTitle: events.title,
      eventSlug: events.slug,
      metadata: orders.metadata,
    })
    .from(orders)
    .leftJoin(events, eq(events.id, orders.eventId))
    .where(and(
      gte(orders.createdAt, since),
      isNotNull(orders.guestEmail),
      inArray(orders.paymentMethod, PAYMENT_METHODS),
    ))
    .limit(500) as FollowupOrder[]

    const recipients = new Map<string, Recipient>()
    for (const order of rows) {
    if (FINAL_STATUSES.includes(order.status ?? "")) continue
    const metadata = order.metadata && typeof order.metadata === "object" && !Array.isArray(order.metadata)
      ? order.metadata as Record<string, unknown>
      : {}
    if (metadata.paymentFollowupSentAt) continue
    const email = order.guestEmail.trim().toLowerCase()
    if (!email) continue
    const recipient = recipients.get(email) ?? { email, name: order.guestName, orders: [] }
    recipient.orders.push(order)
    recipients.set(email, recipient)
  }

    let sent = 0
    let failed = 0
    for (const recipient of recipients.values()) {
      try {
      const content = emailContent(recipient)
      const result = await sendEmail({ to: recipient.email, subject: content.subject, html: content.html, text: content.text })
      if ("skipped" in result) throw new Error(result.reason)
      for (const order of recipient.orders) {
        await db.execute(
          sql`UPDATE orders
              SET metadata = jsonb_set(COALESCE(${orders.metadata}, '{}'::jsonb), '{paymentFollowupSentAt}', to_jsonb(${new Date().toISOString()}::text), true),
                  updated_at = NOW()
              WHERE ${orders.id} = ${order.id}`,
        )
      }
      sent++
      } catch (error) {
        failed++
        log.warn("cron/payment-followups — email failed", { email: recipient.email, error: String(error) })
      }
    }

    return NextResponse.json({ sent, failed, qualifyingAttempts: rows.length })
  } finally {
    await releaseLock(lockKey)
  }
}
