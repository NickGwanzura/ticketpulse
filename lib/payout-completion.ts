import "server-only"

import { and, eq } from "drizzle-orm"

import { db } from "@/db"
import { events, payoutAuditLog, payouts, users } from "@/db/schema"
import { sendPayoutNotificationEmail } from "@/lib/email"
import { log } from "@/lib/logger"
import { buildPayoutStatementData } from "@/lib/payout-statement-data"
import { getBaseUrl } from "@/lib/url-config"
import { formatChatId, isSessionReady, sendDocument, sendText } from "@/lib/whatsapp"

const NOTIFIED_ACTION = "completion_notified"

function methodLabel(method: string) {
  if (method === "ecocash") return "EcoCash"
  if (method === "cash") return "Cash"
  return "USD bank transfer"
}

function mask(value: string | null | undefined) {
  const v = (value ?? "").replace(/\s/g, "")
  return v.length > 4 ? `****${v.slice(-4)}` : v
}

/** Build the receipt data for a payout, or null if it doesn't exist / isn't paid. */
export async function buildPayoutReceiptData(payoutId: string) {
  const [row] = await db
    .select({
      id: payouts.id,
      userId: payouts.userId,
      amount: payouts.amount,
      currency: payouts.currency,
      method: payouts.method,
      status: payouts.status,
      accountName: payouts.accountName,
      accountNumber: payouts.accountNumber,
      bankName: payouts.bankName,
      proofReference: payouts.proofReference,
      processedAt: payouts.processedAt,
      createdAt: payouts.createdAt,
      eventTitle: events.title,
      organizerName: users.name,
      organizerEmail: users.email,
    })
    .from(payouts)
    .leftJoin(events, eq(events.id, payouts.eventId))
    .innerJoin(users, eq(users.id, payouts.userId))
    .where(eq(payouts.id, payoutId))
    .limit(1)
  if (!row || row.status !== "paid") return null

  const { getOrganizerRevenueSummary } = await import("@/lib/revenue-summary")
  const summary = await getOrganizerRevenueSummary(row.userId)
  const paidAt = row.processedAt ?? row.createdAt
  const destination =
    row.method === "ecocash"
      ? `EcoCash ${mask(row.accountNumber) || ""}`.trim()
      : [row.bankName, row.accountName, mask(row.accountNumber)].filter(Boolean).join(" · ") || "Nominated account"

  return {
    userId: row.userId,
    receiptNumber: `TP-RC-${paidAt.toISOString().slice(0, 10).replace(/-/g, "")}-${row.id.slice(0, 6).toUpperCase()}`,
    payoutReference: row.id.slice(0, 8).toUpperCase(),
    issuedAt: new Date(),
    paidAt,
    organizerName: row.organizerName ?? "Organiser",
    organizerEmail: row.organizerEmail ?? "",
    eventTitle: row.eventTitle,
    method: methodLabel(row.method),
    destination,
    amount: Number(row.amount),
    currency: row.currency ?? "USD",
    transactionReference: row.proofReference,
    availableBalanceAfter: summary.availableBalance,
  }
}

/**
 * Tell the organiser a payout has been paid: email with the receipt and
 * statement PDFs attached, plus a WhatsApp message with the same documents.
 * Safe to call more than once per payout; the audit log guards against repeats.
 * Delivery failures are logged, never thrown, so they can't undo a payout.
 */
export async function notifyPayoutCompleted(
  payoutId: string,
  options: { force?: boolean } = {},
): Promise<{ channels: string[] }> {
  const channels: string[] = []
  try {
    const [already] = options.force ? [] : await db
      .select({ id: payoutAuditLog.id })
      .from(payoutAuditLog)
      .where(and(eq(payoutAuditLog.payoutId, payoutId), eq(payoutAuditLog.action, NOTIFIED_ACTION)))
      .limit(1)
    if (already) return { channels }

    const receipt = await buildPayoutReceiptData(payoutId)
    if (!receipt) return { channels }

    const [owner] = await db
      .select({ id: users.id, phone: users.phone })
      .from(payouts)
      .innerJoin(users, eq(users.id, payouts.userId))
      .where(eq(payouts.id, payoutId))
      .limit(1)
    if (!owner) return { channels }

    const { generatePayoutReceiptPdfBuffer } = await import("@/lib/pdf/payout-receipt-document")
    const { generatePayoutStatementPdfBuffer } = await import("@/lib/pdf/payout-statement-document")
    const statementData = await buildPayoutStatementData(owner.id)
    const [receiptPdf, statementPdf] = await Promise.all([
      generatePayoutReceiptPdfBuffer(receipt),
      statementData ? generatePayoutStatementPdfBuffer(statementData) : Promise.resolve(null),
    ])

    const receiptName = `TicketPulse_Payout_Receipt_${receipt.payoutReference}.pdf`
    const statementName = `TicketPulse_Payout_Statement_${new Date().toISOString().slice(0, 10)}.pdf`
    const amountText = receipt.amount.toFixed(2)

    if (receipt.organizerEmail) {
      try {
        await sendPayoutNotificationEmail({
          to: receipt.organizerEmail,
          organizerName: receipt.organizerName,
          payoutId: receipt.payoutReference,
          amount: amountText,
          currency: receipt.currency,
          method: receipt.method,
          destination: receipt.destination,
          eventTitle: receipt.eventTitle ?? "your events",
          attachments: [
            { filename: receiptName, content: receiptPdf },
            ...(statementPdf ? [{ filename: statementName, content: statementPdf }] : []),
          ],
        })
        channels.push("email")
      } catch (err) {
        log.warn("payout completion email failed", { payoutId, error: String(err) })
      }
    }

    if (owner.phone && !(await isSessionReady())) {
      log.warn("payout completion whatsapp skipped: session not ready", { payoutId })
    } else if (owner.phone) {
      try {
        const chatId = formatChatId(owner.phone)
        const first = receipt.organizerName.split(" ")[0] || "there"
        await sendText(
          chatId,
          `Hi ${first}, your TicketPulse payout of ${receipt.currency} ${amountText} has been paid to ${receipt.destination}. ` +
            `Reference ${receipt.payoutReference}. Your receipt and statement are attached. ` +
            `You can also download them any time at ${getBaseUrl()}/payouts`,
        )
        await sendDocument({
          chatId,
          base64: receiptPdf.toString("base64"),
          mimetype: "application/pdf",
          filename: receiptName,
          caption: `Payout receipt ${receipt.receiptNumber}`,
        })
        if (statementPdf) {
          await sendDocument({
            chatId,
            base64: statementPdf.toString("base64"),
            mimetype: "application/pdf",
            filename: statementName,
            caption: "Payout statement",
          })
        }
        channels.push("whatsapp")
      } catch (err) {
        log.warn("payout completion whatsapp failed", { payoutId, error: String(err) })
      }
    }

    if (channels.length > 0) {
      await db.insert(payoutAuditLog).values({
        payoutId,
        action: NOTIFIED_ACTION,
        toStatus: "paid",
        performedBy: options.force ? "admin_resend" : "system",
        notes: `Receipt ${receipt.receiptNumber} sent via ${channels.join(" + ")}`,
      })
    }
  } catch (err) {
    log.error("payout completion notification failed", { payoutId, error: String(err) })
  }
  return { channels }
}
