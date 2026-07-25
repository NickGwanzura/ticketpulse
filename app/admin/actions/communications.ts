"use server"

interface CommunicationResult {
  channel: "email" | "sms"
  target: string
  success: boolean
  error?: string
}

import { revalidatePath } from "next/cache"
import { eq, and, inArray, or, sql } from "drizzle-orm"

import { signIn } from "@/auth"
import { requireAdmin } from "@/lib/auth-guard"
import { db } from "@/db"
import { events, orders, orderItems, paymentLedger, ticketTiers, tickets, users } from "@/db/schema"
import {
  sendEmail,
  adminEmail,
  sendOrderConfirmationEmail,
} from "@/lib/email"
import { eventPublishedNotificationEmail } from "@/lib/email-templates"
import { log } from "@/lib/logger"
import type { VelocityOrderMetadata } from "@/types/velocity"

export async function sendCommunicationAction(
  formData: FormData,
): Promise<CommunicationResult[]> {
  const session = await requireAdmin()

  const subject = formData.get("subject") as string
  const body = formData.get("body") as string
  const audience = formData.get("audience") as string
  const channelsRaw = formData.get("channels") as string

  if (!subject?.trim() || !body?.trim()) {
    throw new Error("Subject and body are required")
  }

  const channels = channelsRaw.split(",").filter(Boolean)
  const results: CommunicationResult[] = []

  // ── Fetch target users ──────────────────────────────────────────────────
  let targetUsers: { id: string; name: string | null; email: string | null; phone: string | null }[]

  if (audience === "attendees") {
    targetUsers = await db
      .select({ id: users.id, name: users.name, email: users.email, phone: users.phone })
      .from(users)
      .where(eq(users.role, "attendee"))
  } else if (audience === "organizers") {
    targetUsers = await db
      .select({ id: users.id, name: users.name, email: users.email, phone: users.phone })
      .from(users)
      .where(
        or(eq(users.role, "organizer"), eq(users.role, "admin")),
      )
  } else {
    targetUsers = await db
      .select({ id: users.id, name: users.name, email: users.email, phone: users.phone })
      .from(users)
  }

  if (targetUsers.length === 0) {
    throw new Error("No users found for the selected audience")
  }

  // ── Email ───────────────────────────────────────────────────────────────
  if (channels.includes("email")) {
    const mailRecipients = targetUsers.filter((u) => u.email)

    const personaliseBody = (name: string | null) => {
      const first = name?.split(" ")[0]?.trim()
      return body.replace(/\{name\}/g, first ?? "there").replace(/\{audience\}/g, audience)
    }

    // Process in chunks of 10 concurrent sends to avoid overwhelming the
    // email provider and hitting serverless function timeouts on large lists.
    const CHUNK = 10
    for (let i = 0; i < mailRecipients.length; i += CHUNK) {
      const chunk = mailRecipients.slice(i, i + CHUNK)
      await Promise.all(
        chunk.map(async (u) => {
    try {
        const personalised = personaliseBody(u.name)
        const { html, text } = (() => {
          const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://ticketpulse.tech"
          const paragraphs = personalised
            .split("\n")
            .filter(Boolean)
            .map((p) => `<p style="margin:0 0 14px;font-size:15px;line-height:24px;color:#384151;">${p.replace(/<[^>]*>/g, "")}</p>`)
            .join("")
          const html = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${subject}</title></head>
<body style="margin:0;padding:0;background:#F6F9FC;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0B1220;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#F6F9FC;"><tr><td align="center" style="padding:32px 16px;">
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:560px;">
      <tr><td style="padding-bottom:8px;">
        <table role="presentation" cellpadding="0" cellspacing="0"><tr>
          <td style="vertical-align:middle;padding-right:10px;">
            <img src="${appUrl}/logo.svg" alt="TicketPulse" width="32" height="32" style="display:block;outline:none;border:none;border-radius:6px;" />
          </td>
          <td style="vertical-align:middle;"><span style="font-size:18px;font-weight:700;letter-spacing:-0.01em;color:#0B1220;">TicketPulse</span></td>
        </tr></table>
      </td></tr>
      <tr><td style="background:#FFFFFF;border:1px solid #E6ECF2;border-radius:16px;padding:32px 28px;box-shadow:0 1px 2px rgba(11,18,32,0.04);">
        <h1 style="margin:0 0 12px;font-size:24px;font-weight:700;line-height:1.2;letter-spacing:-0.02em;color:#0B1220;">${subject}</h1>
        <div style="font-size:15px;line-height:24px;color:#384151;">${paragraphs}</div>
      </td></tr>
      <tr><td style="padding:20px 4px 0;">
        <hr style="border:none;border-top:1px solid #E6ECF2;margin:0 0 16px;" />
        <p style="margin:0;font-size:12px;line-height:18px;color:#6B7280;">TicketPulse &middot; Harare, Zimbabwe &middot; <a href="${appUrl}" style="color:#384151;text-decoration:underline;">ticketpulse.tech</a></p>
        <p style="margin:6px 0 0;font-size:12px;line-height:18px;color:#6B7280;">You are receiving this because of activity on your TicketPulse account.</p>
      </td></tr>
    </table>
  </td></tr></table>
</body>
</html>`
          return { html, text: personalised }
        })()

        await sendEmail({ to: u.email!, subject, html, text })
        results.push({ channel: "email", target: u.email!, success: true })
      } catch (err) {
        results.push({
          channel: "email",
          target: u.email ?? "unknown",
          success: false,
          error: err instanceof Error ? err.message : "unknown error",
        })
      }
        }),
      )
    }
  }

  // ── SMS ─────────────────────────────────────────────────────────────────
  // Uses VelocityAfrica SMS (official carrier channel) rather than the
  // unofficial WhatsApp automation this used to go through — that path
  // risked getting the connected WhatsApp Business number banned for bulk
  // non-transactional sends, with no official Business API in between.
  if (channels.includes("sms")) {
    const { sendCustomSms, getSmsBalance } = await import("@/lib/velocity/sms")
    const { normaliseMsisdn, isValidMsisdn } = await import("@/lib/velocity/validation")

    // Normalize + dedupe by canonical number — the same phone entered as
    // 077... vs +263... vs 263... across different accounts would otherwise
    // be counted (and billed, and messaged) twice.
    const seen = new Map<string, { name: string | null; phone: string }>()
    for (const u of targetUsers) {
      if (!u.phone || !isValidMsisdn(u.phone)) continue
      const key = normaliseMsisdn(u.phone)
      if (!seen.has(key)) seen.set(key, { name: u.name, phone: u.phone })
    }
    const smsRecipients = Array.from(seen.values())

    const { balance } = await getSmsBalance()
    if (balance < smsRecipients.length) {
      throw new Error(
        `Not enough SMS credits. Need ${smsRecipients.length}, have ${balance}. Top up before sending.`,
      )
    }

    for (const u of smsRecipients) {
      const first = u.name?.split(" ")[0]?.trim()
      const personalised = body
        .replace(/\{name\}/g, first ?? "there")
        .replace(/\{audience\}/g, audience)
      try {
        await sendCustomSms(u.phone, `${subject}\n\n${personalised}`)
        results.push({ channel: "sms", target: u.phone, success: true })
      } catch (err) {
        results.push({
          channel: "sms",
          target: u.phone,
          success: false,
          error: err instanceof Error ? err.message : "unknown error",
        })
      }
      // Small spacing between sends so we don't hammer the provider.
      await new Promise((r) => setTimeout(r, 250))
    }
  }

  revalidatePath("/admin/communications")
  revalidatePath("/admin")

  return results
}

/**
 * Re-check a pending/awaiting_verification order against Velocity.
 * Polls the transaction using the stored transactionTrace and, if SUCCESS,
 * re-finalizes the workflow and updates the local DB.
 *
 * This is the admin recovery tool for stuck transactions:
 * payments confirmed in Velocity but not reflected locally.
 *
 * On FAILED/UNKNOWN, stores failure details without deleting the order.
 * On SUCCESS, issues ticket verification email if not already sent.
 */
