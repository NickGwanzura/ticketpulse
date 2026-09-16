"use server"

import { eq, desc, sql, and, inArray } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { auth } from "@/auth"
import { db } from "@/db"
import { payouts, events, users, payoutAuditLog } from "@/db/schema"
import { log } from "@/lib/logger"
import { adminEmail, sendEmail } from "@/lib/email"
import { getBaseUrl } from "@/lib/url-config"
import { getOrganizerRevenueSummary, PLATFORM_FEE_PERCENT } from "@/lib/revenue-summary"
const ACTIVE_PAYOUT_STATUSES = ["pending", "approved", "processing"] as const
const VALID_METHODS = ["ecocash", "bank_usd"] as const

const ecocashPattern = /^(\+?263|0)?7[1789]\d{7}$/

// ecocashNumber vs accountNumber/accountName/bankName are conditionally
// rendered in the form (only one group exists in the DOM at a time), so the
// unrendered group is always *absent* from FormData — .get() returns null,
// not undefined. z.string().optional()/.default() only rescue undefined, so
// .nullish() is required here or every submission fails on the hidden group.
const RequestPayoutSchema = z
  .object({
    amount: z.coerce.number({ error: "Enter a valid payout amount." }),
    currency: z.string().nullish().transform((c) => c ?? "USD"),
    method: z.enum(VALID_METHODS, { error: "Choose a valid payout method." }),
    ecocashNumber: z.string().trim().nullish().transform((v) => v ?? ""),
    accountNumber: z.string().trim().nullish().transform((v) => v ?? ""),
    accountName: z.string().trim().nullish().transform((v) => v ?? ""),
    bankName: z.string().trim().nullish().transform((v) => v ?? ""),
  })
  .superRefine((data, ctx) => {
    if (data.currency !== "USD") {
      ctx.addIssue({ code: "custom", path: ["currency"], message: "Payouts are currently only available in USD." })
    }
    if (data.amount < 1) {
      ctx.addIssue({ code: "custom", path: ["amount"], message: "Minimum payout request is USD 1.00." })
    } else if (data.amount > 100000) {
      ctx.addIssue({ code: "custom", path: ["amount"], message: "This payout amount is above the allowed limit." })
    }
    if (data.method === "ecocash") {
      if (!data.ecocashNumber || !ecocashPattern.test(data.ecocashNumber.replace(/\s/g, ""))) {
        ctx.addIssue({ code: "custom", path: ["ecocashNumber"], message: "Enter a valid Zimbabwe EcoCash number." })
      }
    } else {
      if (!data.accountNumber || data.accountNumber.length < 5) {
        ctx.addIssue({ code: "custom", path: ["accountNumber"], message: "Enter a valid bank account number." })
      }
      if (!data.accountName || data.accountName.length < 2) {
        ctx.addIssue({ code: "custom", path: ["accountName"], message: "Enter the bank account holder name." })
      }
      if (!data.bankName || data.bankName.length < 2) {
        ctx.addIssue({ code: "custom", path: ["bankName"], message: "Enter the bank name." })
      }
    }
  })

function money(value: number) {
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function methodLabel(method: string) {
  if (method === "ecocash") return "EcoCash"
  return "USD bank transfer"
}

function destinationLabel(opts: {
  method: string
  ecocashNumber?: string
  bankName?: string
  accountName?: string
  accountNumber?: string
}) {
  if (opts.method === "ecocash") return opts.ecocashNumber ?? "EcoCash"
  return [opts.bankName, opts.accountName, opts.accountNumber].filter(Boolean).join(" · ")
}

function payoutRequestEmailHtml(opts: {
  heading: string
  intro: string
  payoutId: string
  organizerName?: string | null
  organizerEmail?: string | null
  amount: number
  grossRevenue: number
  commissionRate: number
  platformFee: number
  availableBalance: number
  method: string
  destination: string
  url: string
  admin?: boolean
}) {
  const rows = [
    ["Requested payout", money(opts.amount)],
    ["Confirmed ticket revenue", money(opts.grossRevenue)],
    [`TicketPulse fee (${opts.commissionRate}%)`, money(opts.platformFee)],
    ["Available before request", money(opts.availableBalance)],
    ["Method", opts.method],
    ["Destination", opts.destination],
    ["Reference", opts.payoutId.slice(0, 8)],
  ]

  return `
    <div style="font-family:Inter,Arial,sans-serif;background:#f6f7fb;padding:28px;color:#09233f">
      <div style="max-width:620px;margin:0 auto;background:#ffffff;border:1px solid #dce3ec;border-radius:16px;padding:26px">
        <p style="margin:0 0 8px;font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#66758a;font-weight:700">TicketPulse payouts</p>
        <h1 style="margin:0 0 12px;font-size:24px;line-height:1.2;color:#09233f">${opts.heading}</h1>
        <p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:#43546b">${opts.intro}</p>
        ${opts.admin ? `<p style="margin:0 0 18px;font-size:14px;color:#43546b"><strong>Organizer:</strong> ${opts.organizerName ?? "Organizer"}${opts.organizerEmail ? ` (${opts.organizerEmail})` : ""}</p>` : ""}
        <table style="width:100%;border-collapse:collapse;background:#f8fafc;border-radius:12px;overflow:hidden">
          ${rows.map(([label, value]) => `
            <tr>
              <td style="padding:12px 14px;border-bottom:1px solid #e6ebf2;font-size:13px;color:#66758a">${label}</td>
              <td style="padding:12px 14px;border-bottom:1px solid #e6ebf2;text-align:right;font-size:14px;color:#09233f;font-weight:700">${value}</td>
            </tr>
          `).join("")}
        </table>
        <p style="margin:18px 0 0;font-size:13px;line-height:1.6;color:#66758a">
          ${opts.admin ? "Open the admin payouts page to approve, process, or reject this request." : "We normally process requests in about 24 hours, plus or minus depending on bank processing times and verification checks."}
        </p>
        <a href="${opts.url}" style="display:inline-block;margin-top:18px;background:#09233f;color:#ffffff;text-decoration:none;border-radius:10px;padding:11px 16px;font-size:14px;font-weight:700">${opts.admin ? "Review payout" : "View payout history"}</a>
      </div>
    </div>
  `
}

function payoutRequestEmailText(opts: {
  payoutId: string
  amount: number
  grossRevenue: number
  commissionRate: number
  platformFee: number
  availableBalance: number
  method: string
  destination: string
}) {
  return [
    `Payout request: ${opts.payoutId}`,
    `Requested payout: ${money(opts.amount)}`,
    `Confirmed ticket revenue: ${money(opts.grossRevenue)}`,
    `TicketPulse fee (${opts.commissionRate}%): ${money(opts.platformFee)}`,
    `Available before request: ${money(opts.availableBalance)}`,
    `Method: ${opts.method}`,
    `Destination: ${opts.destination}`,
    "Requests normally take about 24 hours, plus or minus depending on bank processing times and verification checks.",
  ].join("\n")
}

export async function getOrganizerPayouts(userId: string) {
  const session = await auth()
  if (!session?.user) {
    throw new Error("Unauthorized")
  }

  // Users can only see their own payouts
  if (session.user.id !== userId && session.user.role !== "admin") {
    throw new Error("Unauthorized")
  }
  // Note: This throw is intentional — getOrganizerPayouts is called during
  // server-component render (app/payouts/page.tsx) which already has its
  // own session guard + redirect(). The throw is a safety net.

  const payoutRows = await db
    .select({
      id: payouts.id,
      amount: payouts.amount,
      currency: payouts.currency,
      method: payouts.method,
      status: payouts.status,
      accountNumber: payouts.accountNumber,
      accountName: payouts.accountName,
      bankName: payouts.bankName,
      proofReference: payouts.proofReference,
      notes: payouts.notes,
      balanceSnapshot: payouts.balanceSnapshot,
      rejectionReason: payouts.rejectionReason,
      createdAt: payouts.createdAt,
      processedAt: payouts.processedAt,
      eventTitle: events.title,
    })
    .from(payouts)
    .leftJoin(events, eq(events.id, payouts.eventId))
    .where(eq(payouts.userId, userId))
    .orderBy(desc(payouts.createdAt))
    .limit(100)

  const stats = await db
    .select({
      pending: sql<string>`count(case when ${payouts.status} = 'pending' then 1 end)`.mapWith(Number),
      paid: sql<string>`count(case when ${payouts.status} = 'paid' then 1 end)`.mapWith(Number),
      totalPaid: sql<string>`coalesce(sum(case when ${payouts.status} = 'paid' then ${payouts.amount} else 0 end), 0)`.mapWith(Number),
    })
    .from(payouts)
    .where(eq(payouts.userId, userId))

  return {
    payouts: payoutRows,
    stats: stats[0] ?? { pending: 0, paid: 0, totalPaid: 0 },
  }
}

async function fetchBalanceForUser(userId: string) {
  const [userRow] = await db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  if (userRow?.role !== "organizer" && userRow?.role !== "admin") {
    return {
      availableBalance: 0,
      totalEarned: 0,
      totalPaidOut: 0,
      pendingTotal: 0,
      outstandingClawbacks: 0,
      commissionRate: PLATFORM_FEE_PERCENT,
      grossRevenue: 0,
      platformFee: 0,
      confirmedOrderCount: 0,
      confirmedTicketCount: 0,
    }
  }

  const summary = await getOrganizerRevenueSummary(userId)
  return {
    availableBalance: summary.availableBalance,
    totalEarned: summary.netRevenue,
    totalPaidOut: summary.paidOut,
    pendingTotal: summary.pendingPayouts,
    outstandingClawbacks: summary.outstandingClawbacks,
    commissionRate: summary.commissionRate,
    grossRevenue: summary.grossRevenue,
    platformFee: summary.platformFee,
    confirmedOrderCount: summary.confirmedOrderCount,
    confirmedTicketCount: summary.confirmedTicketCount,
  }
}

export async function getOrganizerBalance(userId: string) {
  const session = await auth()
  if (!session?.user) {
    throw new Error("Unauthorized")
  }

  if (session.user.id !== userId && session.user.role !== "admin") {
    throw new Error("Unauthorized")
  }
  // Note: This throw is intentional — getOrganizerBalance is called during
  // server-component render (app/payouts/page.tsx) which has its own session
  // guard + redirect(). The throw is a safety net.

  return fetchBalanceForUser(userId)
}

export type PayoutActionResult = {
  ok: boolean
  message: string
  payoutId?: string
}

function payoutActionError(message: string): PayoutActionResult {
  revalidatePath("/payouts")
  return { ok: false, message }
}

export async function requestPayoutAction(formData: FormData): Promise<PayoutActionResult> {
  const session = await auth()
  if (!session?.user) {
    log.warn("[request-payout] Unauthorized")
    return payoutActionError("Please sign in again before requesting a payout.")
  }

  const userId = session.user.id

  const parsed = RequestPayoutSchema.safeParse({
    amount: formData.get("amount"),
    currency: formData.get("currency"),
    method: formData.get("method"),
    ecocashNumber: formData.get("ecocashNumber"),
    accountNumber: formData.get("accountNumber"),
    accountName: formData.get("accountName"),
    bankName: formData.get("bankName"),
  })
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid payout request."
    log.warn("[request-payout] Validation failed", { issues: parsed.error.issues })
    return payoutActionError(message)
  }
  const { amount, currency, method, ecocashNumber, accountNumber, accountName, bankName } = parsed.data

  // Check available balance
  let balance: Awaited<ReturnType<typeof fetchBalanceForUser>>
  try {
    balance = await fetchBalanceForUser(userId)
  } catch (err) {
    log.error("[request-payout] Balance fetch failed", { error: String(err) })
    return payoutActionError("We could not calculate your payout balance. Please try again.")
  }
  const { availableBalance } = balance
  if (availableBalance <= 0) { log.warn("[request-payout] No funds available"); return payoutActionError("There is no available balance to withdraw yet.") }
  if (amount > availableBalance) { log.warn("[request-payout] Insufficient balance"); return payoutActionError(`You can request up to ${money(availableBalance)} right now.`) }

  const [organizer] = await db
    .select({ name: users.name, email: users.email })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  const cleanAmount = Number(amount.toFixed(2))
  const methodName = methodLabel(method)
  const destination = destinationLabel({
    method,
    ecocashNumber,
    bankName,
    accountName,
    accountNumber,
  })

  // Insert the payout and audit log atomically. The duplicate check runs inside
  // the transaction to close the TOCTOU window between the balance read and insert.
  // A partial unique index (payouts_one_active_per_user) also catches the race
  // at READ COMMITTED; the unique-violation check below covers that path too.
  let inserted: { id: string } | undefined
  try {
    inserted = await db.transaction(async (tx) => {
      const [existingPending] = await tx
        .select({ id: payouts.id })
        .from(payouts)
        .where(
          and(
            eq(payouts.userId, userId),
            inArray(payouts.status, ACTIVE_PAYOUT_STATUSES)
          )
        )
        .limit(1)

      if (existingPending) {
        throw new Error("ALREADY_PENDING")
      }

      const [result] = await tx
        .insert(payouts)
        .values({
          userId,
          amount: cleanAmount.toFixed(2),
          currency,
          method,
          status: "pending",
          accountNumber: method === "ecocash" ? ecocashNumber : accountNumber,
          accountName: method === "ecocash" ? organizer?.name ?? undefined : accountName,
          bankName: method === "ecocash" ? "EcoCash" : bankName,
          balanceSnapshot: {
            grossRevenue: Number(balance.grossRevenue.toFixed(2)),
            platformFeePercent: balance.commissionRate,
            platformFee: balance.platformFee,
            netRevenue: balance.totalEarned,
            paidOut: balance.totalPaidOut,
            activePending: balance.pendingTotal,
            availableBeforeRequest: availableBalance,
            confirmedOrderCount: balance.confirmedOrderCount,
            confirmedTicketCount: balance.confirmedTicketCount,
            destination,
          },
        })
        .returning({ id: payouts.id })

      await tx.insert(payoutAuditLog).values({
        payoutId: result.id,
        action: "requested",
        toStatus: "pending",
        performedBy: session.user.email ?? userId,
        notes: `Payout of ${cleanAmount.toFixed(2)} ${currency} requested via ${methodName}. Gross tickets ${balance.grossRevenue.toFixed(2)} less ${balance.commissionRate}% fee.`,
      })

      return result
    })
  } catch (txErr) {
    const message = String(txErr)
    if (message === "ALREADY_PENDING" || message.includes("unique") || message.includes("duplicate")) {
      log.warn("[request-payout] Already pending", { userId })
      return payoutActionError("You already have an active payout request. Wait for it to be processed before requesting another one.")
    }
    log.error("[request-payout] Transaction failed", { error: String(txErr) })
    return payoutActionError("We could not submit the payout request. Please try again.")
  }

  if (!inserted) {
    log.warn("[request-payout] Insert returned no id")
    return payoutActionError("We could not confirm the payout request. Please try again.")
  }

  const baseUrl = getBaseUrl()
  const emailArgs = {
    payoutId: inserted.id,
    organizerName: organizer?.name,
    organizerEmail: organizer?.email,
    amount: cleanAmount,
    grossRevenue: balance.grossRevenue,
    commissionRate: balance.commissionRate,
    platformFee: balance.platformFee,
    availableBalance,
    method: methodName,
    destination,
  }

  if (organizer?.email) {
    sendEmail({
      to: organizer.email,
      subject: "Payout request received",
      html: payoutRequestEmailHtml({
        ...emailArgs,
        heading: "Your payout request was received",
        intro: "Thanks. TicketPulse has received your payout request and queued it for admin review.",
        url: `${baseUrl}/payouts`,
      }),
      text: payoutRequestEmailText(emailArgs),
    }).catch((err) => log.warn("requestPayoutAction - organizer email failed", { payoutId: inserted.id, error: String(err) }))
  }

  sendEmail({
    to: adminEmail,
    subject: `New payout request — ${money(cleanAmount)}`,
    html: payoutRequestEmailHtml({
      ...emailArgs,
      heading: "New payout request",
      intro: "An organizer submitted a payout request. Review the destination details and confirmed ticket revenue before processing.",
      url: `${baseUrl}/admin/payouts?status=pending`,
      admin: true,
    }),
    text: payoutRequestEmailText(emailArgs),
  }).catch((err) => log.warn("requestPayoutAction - admin email failed", { payoutId: inserted.id, error: String(err) }))

  log.info("Payout requested", { userId, amount: cleanAmount, currency, method, payoutId: inserted.id })
  revalidatePath("/payouts")
  revalidatePath("/admin/payouts")
  return { ok: true, message: "Payout request submitted.", payoutId: inserted.id }
}
