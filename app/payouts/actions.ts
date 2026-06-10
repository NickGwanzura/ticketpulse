"use server"

import { eq, desc, sql, and, inArray } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { auth } from "@/auth"
import { db } from "@/db"
import { payouts, events, users, payoutAuditLog } from "@/db/schema"
import { log } from "@/lib/logger"
import { adminEmail, sendEmail } from "@/lib/email"
import { getBaseUrl } from "@/lib/url-config"
import { getOrganizerRevenueSummary, PLATFORM_FEE_PERCENT } from "@/lib/revenue-summary"
const ACTIVE_PAYOUT_STATUSES = ["pending", "approved", "processing"] as const
const VALID_METHODS = ["ecocash", "bank_usd"] as const
type PayoutMethod = (typeof VALID_METHODS)[number]

function isPayoutMethod(value: string): value is PayoutMethod {
  return VALID_METHODS.some((method) => method === value)
}

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
    [`TicketPulse fee (${PLATFORM_FEE_PERCENT}%)`, money(opts.platformFee)],
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
  platformFee: number
  availableBalance: number
  method: string
  destination: string
}) {
  return [
    `Payout request: ${opts.payoutId}`,
    `Requested payout: ${money(opts.amount)}`,
    `Confirmed ticket revenue: ${money(opts.grossRevenue)}`,
    `TicketPulse fee (${PLATFORM_FEE_PERCENT}%): ${money(opts.platformFee)}`,
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
      pending: sql<number>`count(case when ${payouts.status} = 'pending' then 1 end)`,
      paid: sql<number>`count(case when ${payouts.status} = 'paid' then 1 end)`,
      totalPaid: sql<number>`coalesce(sum(case when ${payouts.status} = 'paid' then ${payouts.amount} else 0 end), 0)`,
    })
    .from(payouts)
    .where(eq(payouts.userId, userId))

  return {
    payouts: payoutRows,
    stats: stats[0] ?? { pending: 0, paid: 0, totalPaid: 0 },
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
      commissionRate: PLATFORM_FEE_PERCENT,
      grossRevenue: 0,
      platformFee: 0,
      confirmedOrderCount: 0,
      confirmedTicketCount: 0,
    }
  }

  // Single source of truth — same maths as the organizer dashboard and
  // admin reconciliation surfaces.
  const summary = await getOrganizerRevenueSummary(userId)

  return {
    availableBalance: summary.availableBalance,
    totalEarned: summary.netRevenue,
    totalPaidOut: summary.paidOut,
    pendingTotal: summary.pendingPayouts,
    commissionRate: PLATFORM_FEE_PERCENT,
    grossRevenue: summary.grossRevenue,
    platformFee: summary.platformFee,
    confirmedOrderCount: summary.confirmedOrderCount,
    confirmedTicketCount: summary.confirmedTicketCount,
  }
}

export async function requestPayoutAction(formData: FormData) {
  const session = await auth()
  if (!session?.user) {
    throw new Error("Unauthorized")
  }

  const userId = session.user.id
  const amount = parseFloat(formData.get("amount") as string)
  const currency = (formData.get("currency") as string) ?? "USD"
  const method = (formData.get("method") as string) ?? "bank_usd"
  const ecocashNumber = ((formData.get("ecocashNumber") as string) ?? "").trim()
  const accountNumber = ((formData.get("accountNumber") as string) ?? "").trim()
  const accountName = ((formData.get("accountName") as string) ?? "").trim()
  const bankName = ((formData.get("bankName") as string) ?? "").trim()

  if (!isPayoutMethod(method)) {
    throw new Error("Please choose a valid payout method")
  }

  if (currency !== "USD") {
    throw new Error("Payout requests are currently available in USD only")
  }

  // Validate amount
  if (!amount || amount <= 0 || isNaN(amount)) {
    throw new Error("Invalid amount")
  }

  if (amount > 100000) {
    throw new Error("Maximum payout amount is $100,000")
  }

  if (method === "ecocash") {
    if (!ecocashNumber || !/^(\+?263|0)?7[1789]\d{7}$/.test(ecocashNumber.replace(/\s/g, ""))) {
      throw new Error("Please enter a valid EcoCash number (e.g. 0771 234 567)")
    }
  } else {
    if (!accountNumber || accountNumber.length < 5) {
      throw new Error("Please enter a valid account number")
    }
    if (!accountName || accountName.trim().length < 2) {
      throw new Error("Please enter the full account holder name")
    }
    if (!bankName || bankName.trim().length < 2) {
      throw new Error("Please enter the bank name")
    }
  }

  // Check available balance
  const balance = await getOrganizerBalance(userId)
  const { availableBalance } = balance
  if (amount > availableBalance) {
    throw new Error("Insufficient balance")
  }

  if (availableBalance <= 0) {
    throw new Error("No funds available for payout")
  }

  // Prevent duplicate active payout
  const [existingPending] = await db
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
    throw new Error("You already have a pending payout request. Please wait for it to be processed before requesting another.")
  }

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

  // Insert the payout and audit log atomically.
  const inserted = await db.transaction(async (tx) => {
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
        notes: JSON.stringify({
          grossRevenue: Number(balance.grossRevenue.toFixed(2)),
          platformFeePercent: PLATFORM_FEE_PERCENT,
          platformFee: balance.platformFee,
          netRevenue: balance.totalEarned,
          paidOut: balance.totalPaidOut,
          activePending: balance.pendingTotal,
          availableBeforeRequest: availableBalance,
          confirmedOrderCount: balance.confirmedOrderCount,
          confirmedTicketCount: balance.confirmedTicketCount,
          destination,
        }),
      })
      .returning({ id: payouts.id })

    await tx.insert(payoutAuditLog).values({
      payoutId: result.id,
      action: "requested",
      toStatus: "pending",
      performedBy: session.user.email ?? userId,
      notes: `Payout of ${cleanAmount.toFixed(2)} ${currency} requested via ${methodName}. Gross tickets ${balance.grossRevenue.toFixed(2)} less ${PLATFORM_FEE_PERCENT}% fee.`,
    })

    return result
  })

  const baseUrl = getBaseUrl()
  const emailArgs = {
    payoutId: inserted.id,
    organizerName: organizer?.name,
    organizerEmail: organizer?.email,
    amount: cleanAmount,
    grossRevenue: balance.grossRevenue,
    platformFee: balance.platformFee,
    availableBalance,
    method: methodName,
    destination,
  }

  if (organizer?.email) {
    await sendEmail({
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

  await sendEmail({
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
  return { ok: true, payoutId: inserted.id }
}
