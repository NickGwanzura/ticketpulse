"use server"

import { redirect } from "next/navigation"
import { headers } from "next/headers"
import { and, desc, eq, inArray } from "drizzle-orm"

import { db } from "@/db"
import { events, orders } from "@/db/schema"
import { sendEmail } from "@/lib/email"
import { escape, formatMoney } from "@/lib/email-templates/shared"
import { log } from "@/lib/logger"
import { rateLimit } from "@/lib/rate-limit"
import { generateOrderAccessUrl } from "@/lib/tickets"

// Each request sends an email, so keep both the per-IP and per-address budgets tight.
const lookupIpLimiter = rateLimit({ windowMs: 10 * 60_000, max: 5 })
const lookupEmailLimiter = rateLimit({ windowMs: 10 * 60_000, max: 3 })

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const STATUS_LABEL: Record<string, string> = {
  paid: "Paid",
  completed: "Paid",
  pending: "Awaiting payment",
  awaiting_verification: "Confirming payment",
}

/**
 * Emails the buyer a signed link to each of their orders.
 *
 * Results are never shown on the page: knowing an address must not reveal
 * whether it bought tickets, let alone expose the QR codes. The response is
 * the same whether or not any orders matched.
 */
export async function emailOrderLinksAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase()
  if (!EMAIL_RE.test(email)) redirect("/orders/lookup?error=invalid_email")

  const requestHeaders = await headers()
  const ip = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"
  const [byIp, byEmail] = await Promise.all([
    lookupIpLimiter.checkDistributed(`lookup:ip:${ip}`),
    lookupEmailLimiter.checkDistributed(`lookup:email:${email}`),
  ])
  if (!byIp.allowed || !byEmail.allowed) redirect("/orders/lookup?error=rate_limited")

  const rows = await db
    .select({
      id: orders.id,
      status: orders.status,
      totalAmount: orders.totalAmount,
      currency: orders.currency,
      eventTitle: events.title,
      eventStartsAt: events.startsAt,
    })
    .from(orders)
    .leftJoin(events, eq(events.id, orders.eventId))
    .where(and(
      eq(orders.guestEmail, email),
      inArray(orders.status, ["paid", "completed", "pending", "awaiting_verification"]),
    ))
    .orderBy(desc(orders.createdAt))
    .limit(20)

  if (rows.length > 0) {
    const items = rows.map((row) => {
      const title = row.eventTitle ?? "TicketPulse event"
      const date = row.eventStartsAt
        ? new Date(row.eventStartsAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Harare" })
        : ""
      const amount = row.totalAmount ? formatMoney(Number(row.totalAmount), row.currency ?? "USD") : ""
      const status = STATUS_LABEL[row.status ?? ""] ?? "Order"
      return { url: generateOrderAccessUrl(row.id), title, date, amount, status }
    })

    const html = `
      <div style="font-family:Arial,Helvetica,sans-serif;color:#0B1220;max-width:560px;margin:0 auto;padding:24px">
        <h1 style="font-size:22px;margin:0 0 8px">Your TicketPulse orders</h1>
        <p style="font-size:14px;color:#384151;margin:0 0 20px">Someone (hopefully you) asked for links to the tickets bought with this email address. Open an order to see your QR codes.</p>
        ${items.map((item) => `
          <a href="${escape(item.url)}" style="display:block;text-decoration:none;color:#0B1220;border:1px solid #E6ECF2;border-radius:12px;padding:14px 16px;margin-bottom:10px">
            <strong style="font-size:15px">${escape(item.title)}</strong><br>
            <span style="font-size:13px;color:#6B7280">${escape([item.date, item.amount, item.status].filter(Boolean).join(" · "))}</span>
          </a>`).join("")}
        <p style="font-size:12px;color:#6B7280;margin-top:20px">If you didn't ask for this, you can ignore this email. Your tickets are safe.</p>
      </div>`
    const text = [
      "Your TicketPulse orders",
      "",
      ...items.map((item) => `${item.title} (${[item.date, item.amount, item.status].filter(Boolean).join(" · ")})\n${item.url}`),
      "",
      "If you didn't ask for this, you can ignore this email.",
    ].join("\n")

    try {
      await sendEmail({ to: email, subject: "Your TicketPulse ticket links", html, text })
    } catch (err) {
      log.error("order lookup — email send failed", { error: err instanceof Error ? err.message : String(err) })
      redirect("/orders/lookup?error=send_failed")
    }
  }

  redirect(`/orders/lookup?sent=${encodeURIComponent(email)}`)
}
