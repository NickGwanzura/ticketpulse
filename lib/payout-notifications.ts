import "server-only"

import { sendEmail } from "@/lib/email"
import { log } from "@/lib/logger"
import { formatChatId, sendText } from "@/lib/whatsapp"

export type PayoutNoticeStatus = "requested" | "approved" | "processing" | "paid" | "rejected"
export type PayoutNoticeInput = {
  payoutId: string
  organizerName?: string | null
  email?: string | null
  phone?: string | null
  /** EcoCash destination is a safe WhatsApp fallback if profile phone is absent. */
  ecocashNumber?: string | null
  amount: string | number
  /** Legacy methods remain displayable for historical records. New payouts are policy-checked separately. */
  method: string
  status: PayoutNoticeStatus
  eventTitle?: string | null
  proofReference?: string | null
  rejectionReason?: string | null
  channels?: readonly ("email" | "whatsapp")[]
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]!)
}

function statusCopy(status: PayoutNoticeStatus, reason?: string | null) {
  switch (status) {
    case "requested":
      return { subject: "Payout request received", body: "Your payout request has been received and is awaiting admin review." }
    case "approved":
      return { subject: "Payout approved", body: "Your payout request has been approved and will be processed." }
    case "processing":
      return { subject: "Payout processing", body: "Your payout is now being processed." }
    case "paid":
      return { subject: "Payout sent", body: "Your payout has been sent." }
    case "rejected":
      return { subject: "Payout request not approved", body: `Your payout request was not approved.${reason ? ` Reason: ${reason}` : ""}` }
  }
}

/** Send an email and WhatsApp update without allowing delivery failure to undo a committed payout. */
export async function sendPayoutNotice(input: PayoutNoticeInput): Promise<void> {
  const selectedChannels = input.channels ?? ["email", "whatsapp"]
  const recipient = input.organizerName?.trim() || "organiser"
  const amount = Number(input.amount)
  const amountLabel = Number.isFinite(amount) ? `USD ${amount.toFixed(2)}` : "USD amount unavailable"
  const methodLabel = input.method === "ecocash"
    ? "EcoCash"
    : input.method === "bank_usd"
      ? "USD bank transfer"
      : input.method === "bank_zar"
        ? "Legacy ZAR bank transfer"
        : input.method === "cash"
          ? "Legacy cash payout"
          : "Payout method on file"
  const eventLabel = input.eventTitle?.trim() || "your organiser account"
  const copy = statusCopy(input.status, input.rejectionReason)
  const reference = input.proofReference?.trim()
  const text = [
    `Hi ${recipient},`,
    copy.body,
    `Amount: ${amountLabel}`,
    `Method: ${methodLabel}`,
    `Event: ${eventLabel}`,
    reference ? `Reference: ${reference}` : null,
    `Payout ID: ${input.payoutId}`,
  ].filter(Boolean).join("\n")

  const deliver = async (channel: "email" | "whatsapp", send: () => Promise<unknown>) => {
    try {
      const result = await send() as { skipped?: boolean; reason?: string } | null
      if (result?.skipped) {
        log.warn("Payout notification skipped", { payoutId: input.payoutId, channel, reason: result.reason })
      } else {
        log.info("Payout notification sent", { payoutId: input.payoutId, channel, status: input.status })
      }
    } catch (error) {
      log.error("Payout notification failed", {
        payoutId: input.payoutId,
        channel,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  const tasks: Promise<void>[] = []
  if (selectedChannels.includes("email")) {
    if (!input.email?.trim()) {
      log.warn("Payout email not sent: organiser has no email", { payoutId: input.payoutId })
    } else {
      const safeBody = escapeHtml(copy.body)
      const safeName = escapeHtml(recipient)
      const safeEvent = escapeHtml(eventLabel)
      const safeReference = reference ? `<p><strong>Reference:</strong> ${escapeHtml(reference)}</p>` : ""
      const html = `<div style="font-family:Arial,sans-serif;max-width:620px;margin:0 auto;color:#09233f"><h1>${escapeHtml(copy.subject)}</h1><p>Hi ${safeName},</p><p>${safeBody}</p><p><strong>Amount:</strong> ${amountLabel}<br><strong>Method:</strong> ${methodLabel}<br><strong>Event:</strong> ${safeEvent}</p>${safeReference}<p><strong>Payout ID:</strong> ${escapeHtml(input.payoutId)}</p></div>`
      tasks.push(deliver("email", () => sendEmail({
        to: input.email!.trim(),
        subject: `${copy.subject} · ${amountLabel}`,
        html,
        text,
      })))
    }
  }

  if (selectedChannels.includes("whatsapp")) {
    const phone = input.phone?.trim() || (input.method === "ecocash" ? input.ecocashNumber?.trim() : "")
    const digits = phone?.replace(/\D/g, "") ?? ""
    if (!phone || digits.length < 9 || digits.length > 15) {
      log.warn("Payout WhatsApp not sent: organiser has no phone", { payoutId: input.payoutId })
    } else {
      tasks.push(deliver("whatsapp", () => sendText(formatChatId(phone), text)))
    }
  }

  await Promise.all(tasks)
}
