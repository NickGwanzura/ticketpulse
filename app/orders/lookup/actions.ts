"use server"

import { redirect } from "next/navigation"
import { headers } from "next/headers"
import { and, desc, eq, inArray } from "drizzle-orm"

import { db } from "@/db"
import { events, orderItems, orders, ticketTiers } from "@/db/schema"
import { sendEmail, sendOrderConfirmationEmail } from "@/lib/email"
import { generateOrderAccessUrl } from "@/lib/tickets"
import { createOrderRecoveryToken, verifyOrderRecoveryToken } from "@/lib/order-recovery-token"
import { rateLimit } from "@/lib/rate-limit"
import { headers } from "next/headers"
import { getBaseUrl } from "@/lib/url-config"
import { log } from "@/lib/logger"
import { z } from "zod"
const recoveryLimiter = rateLimit({ windowMs: 15 * 60_000, max: 3 })
export async function requestOrderRecoveryAction(formData: FormData) {
  const parsed = z.string().trim().email().max(254).safeParse(formData.get("email"))
  if (!parsed.success) redirect("/orders/lookup?error=missing_email")
  const email = parsed.data.toLowerCase()
  const h = await headers()
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"
  const [addressLimit, ipLimit] = await Promise.all([
    recoveryLimiter.checkDistributed("recovery-email:" + email), recoveryLimiter.checkDistributed("recovery-ip:" + ip),
  ])
  if (addressLimit.allowed && ipLimit.allowed) {
    try {
      const [order] = await db.select({ id: orders.id }).from(orders).where(eq(orders.guestEmail, email)).limit(1)
      if (order) {
        const url = getBaseUrl() + "/orders/lookup?token=" + encodeURIComponent(createOrderRecoveryToken(email))
        await sendEmail({ to: email, subject: "Your secure TicketPulse order link", text: "View your orders: " + url + "\nThis link expires in 15 minutes. If you did not request it, ignore this email.", html: '<p>View your TicketPulse orders using this secure link:</p><p><a href="' + url + '">View my orders</a></p><p>This link expires in 15 minutes. If you did not request it, ignore this email.</p>' })
      }
    } catch (error) { log.error("Order recovery email failed", { error: String(error) }) }
  }
  redirect("/orders/lookup?requested=1")
}

export async function resendLookupTicketsAction(orderId: string, token: string) {
  const normalizedEmail = verifyOrderRecoveryToken(token)
  if (!normalizedEmail) redirect("/orders/lookup?error=expired_link")
  const limited = await recoveryLimiter.checkDistributed("resend:" + normalizedEmail + ":" + orderId)
  if (!limited.allowed) redirect("/orders/lookup?error=too_many_requests")
  const redirectTo = (params: Record<string, string>) => {
    const search = new URLSearchParams({ token, ...params })
    redirect(`/orders/lookup?${search.toString()}`)
  }

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
