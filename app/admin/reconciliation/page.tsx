import Link from "next/link"
import { redirect } from "next/navigation"
import { and, desc, eq, inArray, like, or, sql } from "drizzle-orm"
import { AlertTriangle, Banknote, CheckCircle2, Download, ExternalLink, FileText, ReceiptText, Search, Send, ShieldAlert, TicketCheck, Trash2, Wallet } from "lucide-react"

import { auth } from "@/auth"
import { db } from "@/db"
import { events, orderItems, orders, paymentLedger, tickets } from "@/db/schema"
import PageHeader from "@/components/dashboard/PageHeader"
import EmptyState from "@/components/dashboard/EmptyState"
import { deleteVelocitySettlementAction, recordVelocitySettlementAction, sendVelocityReconciliationAction } from "@/app/admin/reconciliation/actions"
import { auditOrderPaymentLedger, type AuditableLedgerEntry, type PaymentAuditIssue } from "@/lib/payment-ledger-audit"
import { getVelocityReconciliationReport } from "@/lib/velocity-reconciliation"
import { formatCurrency, formatDateShort } from "@/lib/utils"

type ReconciliationIssue = PaymentAuditIssue & {
  area: "payment" | "fulfilment"
}

type RouteSearchParams = {
  q?: string
  severity?: string
  sent?: string
  settlement?: string
}

const SEVERITY_FILTERS = [
  { label: "All", value: "all" },
  { label: "Critical", value: "critical" },
  { label: "Warnings", value: "warning" },
] as const

function toLedgerEntry(row: {
  transactionTrace: string
  salesOrderTrace: string
  invoiceId: string | null
  amount: string | number | null
  currency: string | null
  processor: string
  velocityPollStatus: string | null
  localStatus: string
  source: string
}): AuditableLedgerEntry {
  return {
    transactionTrace: row.transactionTrace,
    salesOrderTrace: row.salesOrderTrace,
    invoiceId: row.invoiceId,
    amount: row.amount,
    currency: row.currency,
    processor: row.processor,
    velocityPollStatus: row.velocityPollStatus,
    localStatus: row.localStatus,
    source: row.source,
  }
}

function deliveryStatus(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object") return null
  const delivery = (metadata as { delivery?: unknown }).delivery
  if (!delivery || typeof delivery !== "object") return null
  const status = (delivery as { status?: unknown }).status
  return typeof status === "string" ? status : null
}

function fulfillmentIssues({
  orderStatus,
  expectedTickets,
  issuedTickets,
  activeTickets,
  settledLedgerRows,
  metadata,
}: {
  orderStatus: string | null
  expectedTickets: number
  issuedTickets: number
  activeTickets: number
  settledLedgerRows: number
  metadata: unknown
}): ReconciliationIssue[] {
  const issues: ReconciliationIssue[] = []
  const paid = orderStatus === "paid" || orderStatus === "completed"
  const delivery = deliveryStatus(metadata)

  if (paid && expectedTickets > 0 && activeTickets === 0) {
    issues.push({
      area: "fulfilment",
      code: "PAID_ORDER_MISSING_TICKETS",
      severity: "critical",
      title: "Paid order has no active tickets",
      detail: "The order is paid/completed and contains ticket items, but no active tickets are attached.",
    })
  }

  if (paid && expectedTickets > 0 && activeTickets > 0 && activeTickets !== expectedTickets) {
    issues.push({
      area: "fulfilment",
      code: "TICKET_COUNT_MISMATCH",
      severity: "warning",
      title: "Ticket quantity mismatch",
      detail: `Expected ${expectedTickets} active ticket(s) from order items, but found ${activeTickets}.`,
    })
  }

  if (!paid && issuedTickets > 0 && settledLedgerRows === 0) {
    issues.push({
      area: "fulfilment",
      code: "TICKETS_WITHOUT_SETTLED_PAYMENT",
      severity: "critical",
      title: "Tickets issued without settled payment",
      detail: "Tickets exist for an order that is not paid/completed and has no settled ledger row.",
    })
  }

  if (paid && expectedTickets > 0 && (!delivery || delivery === "NOT_STARTED")) {
    issues.push({
      area: "fulfilment",
      code: "DELIVERY_NOT_STARTED",
      severity: "warning",
      title: "Paid order has no delivery record",
      detail: "The order is paid/completed, but delivery metadata has not started.",
    })
  }

  if (delivery === "FAILED" || delivery === "EMAIL_FAILED") {
    issues.push({
      area: "fulfilment",
      code: "DELIVERY_FAILED",
      severity: "warning",
      title: "Ticket delivery failed",
      detail: "Delivery metadata indicates email/ticket delivery failed and may need a retry.",
    })
  }

  return issues
}

export default async function AdminReconciliationPage({
  searchParams,
}: {
  searchParams: Promise<RouteSearchParams>
}) {
  const session = await auth()
  if (!session?.user || session.user.role !== "admin") {
    redirect("/auth/signin?callbackUrl=/admin/reconciliation")
  }

  const sp = await searchParams
  const query = sp.q?.trim() ?? ""
  const severityFilter = sp.severity === "critical" || sp.severity === "warning" ? sp.severity : "all"

  const conditions: ReturnType<typeof and>[] = []
  if (query) {
    conditions.push(
      or(
        like(orders.guestEmail, `%${query}%`),
        like(orders.guestName, `%${query}%`),
        like(orders.id, `%${query}%`),
        like(events.title, `%${query}%`),
      ),
    )
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined
  const velocityReport = await getVelocityReconciliationReport()

  const orderRows = await db
    .select({
      id: orders.id,
      status: orders.status,
      totalAmount: orders.totalAmount,
      currency: orders.currency,
      paymentRef: orders.paymentRef,
      metadata: orders.metadata,
      guestEmail: orders.guestEmail,
      guestName: orders.guestName,
      createdAt: orders.createdAt,
      eventTitle: events.title,
      eventSlug: events.slug,
    })
    .from(orders)
    .leftJoin(events, eq(events.id, orders.eventId))
    .where(whereClause)
    .orderBy(desc(orders.createdAt))
    .limit(250)

  const orderIds = orderRows.map((order) => order.id)

  const [ledgerRows, ticketRows, itemRows] = orderIds.length > 0
    ? await Promise.all([
        db
          .select({
            orderId: paymentLedger.orderId,
            transactionTrace: paymentLedger.transactionTrace,
            salesOrderTrace: paymentLedger.salesOrderTrace,
            invoiceId: paymentLedger.invoiceId,
            amount: paymentLedger.amount,
            currency: paymentLedger.currency,
            processor: paymentLedger.processor,
            velocityPollStatus: paymentLedger.velocityPollStatus,
            localStatus: paymentLedger.localStatus,
            source: paymentLedger.source,
            createdAt: paymentLedger.createdAt,
          })
          .from(paymentLedger)
          .where(inArray(paymentLedger.orderId, orderIds)),
        db
          .select({
            orderId: tickets.orderId,
            status: tickets.status,
            count: sql<number>`COUNT(*)::int`,
          })
          .from(tickets)
          .where(inArray(tickets.orderId, orderIds))
          .groupBy(tickets.orderId, tickets.status),
        db
          .select({
            orderId: orderItems.orderId,
            expectedTickets: sql<number>`COALESCE(SUM(${orderItems.quantity}), 0)::int`,
          })
          .from(orderItems)
          .where(and(inArray(orderItems.orderId, orderIds), eq(orderItems.type, "ticket")))
          .groupBy(orderItems.orderId),
      ])
    : [[], [], []]

  const ledgerByOrder = new Map<string, typeof ledgerRows>()
  for (const row of ledgerRows) {
    const list = ledgerByOrder.get(row.orderId) ?? []
    list.push(row)
    ledgerByOrder.set(row.orderId, list)
  }

  const ticketsByOrder = new Map<string, { issued: number; active: number }>()
  for (const row of ticketRows) {
    if (!row.orderId) continue
    const current = ticketsByOrder.get(row.orderId) ?? { issued: 0, active: 0 }
    const count = Number(row.count ?? 0)
    current.issued += count
    if (row.status !== "cancelled" && row.status !== "refunded") current.active += count
    ticketsByOrder.set(row.orderId, current)
  }

  const expectedTicketsByOrder = new Map(itemRows.map((row) => [row.orderId, Number(row.expectedTickets ?? 0)]))

  const findings = orderRows
    .map((order) => {
      const ledger = ledgerByOrder.get(order.id) ?? []
      const settledLedgerRows = ledger.filter((row) => row.localStatus === "paid" || row.localStatus === "completed").length
      const ticketSummary = ticketsByOrder.get(order.id) ?? { issued: 0, active: 0 }
      const expectedTickets = expectedTicketsByOrder.get(order.id) ?? 0
      const issues: ReconciliationIssue[] = [
        ...auditOrderPaymentLedger(
          {
            id: order.id,
            status: order.status,
            totalAmount: order.totalAmount,
            currency: order.currency,
            paymentRef: order.paymentRef,
            metadata: order.metadata,
          },
          ledger.map(toLedgerEntry),
        ).map((issue) => ({ ...issue, area: "payment" as const })),
        ...fulfillmentIssues({
          orderStatus: order.status,
          expectedTickets,
          issuedTickets: ticketSummary.issued,
          activeTickets: ticketSummary.active,
          settledLedgerRows,
          metadata: order.metadata,
        }),
      ]

      return {
        order,
        ledgerRows: ledger.length,
        settledLedgerRows,
        expectedTickets,
        issuedTickets: ticketSummary.issued,
        activeTickets: ticketSummary.active,
        issues: severityFilter === "all" ? issues : issues.filter((issue) => issue.severity === severityFilter),
      }
    })
    .filter((finding) => finding.issues.length > 0)

  const criticalIssues = findings.reduce((sum, finding) => sum + finding.issues.filter((issue) => issue.severity === "critical").length, 0)
  const warningIssues = findings.reduce((sum, finding) => sum + finding.issues.filter((issue) => issue.severity === "warning").length, 0)

  return (
    <div className="tp-fade-up">
      <PageHeader
        eyebrow="Admin"
        title="Payment reconciliation"
        subtitle="Catch mismatches between orders, Velocity metadata, payment ledger rows, issued tickets, and delivery state."
        width="full"
      />

      <div className="px-5 md:px-8 py-8 md:py-10 space-y-6">
        <section className="space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-ink-3">Velocity settlement engine</p>
              <h2 className="mt-1 text-[24px] font-bold tracking-tight text-ink">Money received vs payout liability</h2>
              <p className="mt-1 text-[14px] text-ink-2">
                Reconciles settled Velocity ledger rows against local paid orders, issued tickets, TicketPulse fees, and organizer payouts.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href="#velocity-deposits"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-line bg-paper px-4 py-2.5 text-[13px] font-semibold text-ink transition hover:border-navy"
              >
                <ReceiptText size={14} /> Record Velocity deposit
              </Link>
              <Link
                href="/api/admin/reconciliation/velocity/export"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-navy px-4 py-2.5 text-[13px] font-semibold text-white transition hover:bg-ink"
              >
                <Download size={14} /> Download CSV
              </Link>
              <Link
                href="/api/admin/reconciliation/velocity/export?format=pdf"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-line bg-paper px-4 py-2.5 text-[13px] font-semibold text-ink transition hover:border-navy"
              >
                <FileText size={14} /> Download PDF
              </Link>
            </div>
          </div>

          {sp.sent && (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[13px] font-medium text-emerald-800">
              <CheckCircle2 size={15} />
              Reconciliation report (PDF + CSV) sent to {sp.sent}.
            </div>
          )}

          {sp.settlement === "recorded" && (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[13px] font-medium text-emerald-800">
              <CheckCircle2 size={15} />
              Velocity deposit recorded. The CSV/PDF export and email report now include it.
            </div>
          )}

          <div className="rounded-2xl border border-line bg-paper p-5">
            <div className="mb-4 flex items-center gap-2">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50">
                <Send size={15} className="text-navy" />
              </span>
              <div>
                <p className="text-[14px] font-bold tracking-tight text-ink">Send report to Velocity</p>
                <p className="text-[12px] text-ink-3">Emails the full reconciliation report as PDF and CSV attachments, with a copy to the admin inbox.</p>
              </div>
            </div>
            <form action={sendVelocityReconciliationAction} className="grid gap-3 md:grid-cols-[1.2fr_1.6fr_auto] md:items-end">
              <label className="space-y-1.5 text-[12px] font-semibold text-ink-2">
                Velocity recons email
                <input
                  name="recipient"
                  type="email"
                  required
                  defaultValue={process.env.VELOCITY_RECON_EMAIL ?? ""}
                  placeholder="recons@velocity.co.zw"
                  className="w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-[14px] font-medium text-ink outline-none focus:border-navy"
                />
              </label>
              <label className="space-y-1.5 text-[12px] font-semibold text-ink-2">
                Note (optional)
                <input
                  name="note"
                  maxLength={500}
                  placeholder="e.g. Recon for week ending 8 June — please confirm deposits"
                  className="w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-[14px] font-medium text-ink outline-none focus:border-navy"
                />
              </label>
              <button type="submit" className="inline-flex items-center justify-center gap-2 rounded-xl bg-navy px-5 py-3 text-[13px] font-semibold text-white transition hover:bg-ink">
                <Send size={14} /> Send PDF + CSV
              </button>
            </form>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
            {[
              { label: "Velocity received", value: formatCurrency(velocityReport.totals.velocityReceived, "USD"), note: `${velocityReport.totals.settledVelocityRows} settled ledger row${velocityReport.totals.settledVelocityRows === 1 ? "" : "s"}`, icon: Banknote, tone: "text-emerald-700", bg: "bg-emerald-50" },
              { label: "Paid by Velocity", value: formatCurrency(velocityReport.totals.velocityPaidToTicketPulse, "USD"), note: `${velocityReport.settlements.length} bank deposit${velocityReport.settlements.length === 1 ? "" : "s"} recorded`, icon: ReceiptText, tone: "text-sky-700", bg: "bg-sky-50" },
              { label: "Not yet matched", value: formatCurrency(velocityReport.totals.velocityUnsettled, "USD"), note: "Expected minus deposits entered", icon: AlertTriangle, tone: velocityReport.totals.velocityUnsettled === 0 ? "text-emerald-700" : "text-rose-700", bg: velocityReport.totals.velocityUnsettled === 0 ? "bg-emerald-50" : "bg-rose-50" },
              { label: "Local paid revenue", value: formatCurrency(velocityReport.totals.localPaidRevenue, "USD"), note: `${velocityReport.totals.paidOrders} paid order${velocityReport.totals.paidOrders === 1 ? "" : "s"}`, icon: CheckCircle2, tone: "text-navy", bg: "bg-blue-50" },
              { label: "TicketPulse fee", value: formatCurrency(velocityReport.totals.platformFee, "USD"), note: `${Math.round(velocityReport.feeRate * 100)}% of confirmed Velocity receipts`, icon: ShieldAlert, tone: "text-violet-700", bg: "bg-violet-50" },
              { label: "Available after payouts", value: formatCurrency(velocityReport.totals.availableBalance, "USD"), note: `${formatCurrency(velocityReport.totals.paidOut, "USD")} paid, ${formatCurrency(velocityReport.totals.pendingPayouts, "USD")} pending`, icon: Wallet, tone: "text-amber-700", bg: "bg-amber-50" },
            ].map(({ label, value, note, icon: Icon, tone, bg }) => (
              <div key={label} className="rounded-2xl border border-line bg-paper p-5">
                <div className="mb-4 flex items-center gap-2">
                  <span className={`inline-flex h-8 w-8 items-center justify-center rounded-lg ${bg}`}>
                    <Icon size={15} className={tone} />
                  </span>
                  <span className="text-[12px] font-medium text-ink-3">{label}</span>
                </div>
                <p className="text-[28px] font-bold tracking-tight text-ink tabular-nums">{value}</p>
                <p className="mt-1 text-[12px] text-ink-3">{note}</p>
              </div>
            ))}
          </div>

          <div id="velocity-deposits" className="grid scroll-mt-24 gap-4 xl:grid-cols-[0.9fr_1.1fr]">
            <div className="rounded-2xl border border-line bg-paper p-5">
              <div className="mb-4 flex items-center gap-2">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-sky-50">
                  <ReceiptText size={15} className="text-sky-700" />
                </span>
                <div>
                  <p className="text-[14px] font-bold tracking-tight text-ink">Record money paid by Velocity</p>
                  <p className="text-[12px] text-ink-3">Enter bank deposits or settlement payments Velocity paid into TicketPulse before sending the recon.</p>
                </div>
              </div>
              <form action={recordVelocitySettlementAction} className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="space-y-1.5 text-[12px] font-semibold text-ink-2">
                    Paid date
                    <input name="settlementDate" type="date" required className="w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-[14px] font-medium text-ink outline-none focus:border-navy" />
                  </label>
                  <label className="space-y-1.5 text-[12px] font-semibold text-ink-2">
                    Amount
                    <input name="amount" type="number" min="0.01" step="0.01" required placeholder="0.00" className="w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-[14px] font-medium text-ink outline-none focus:border-navy" />
                  </label>
                </div>
                <div className="grid gap-3 sm:grid-cols-[0.7fr_1.3fr]">
                  <label className="space-y-1.5 text-[12px] font-semibold text-ink-2">
                    Currency
                    <input name="currency" defaultValue="USD" maxLength={8} className="w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-[14px] font-medium uppercase text-ink outline-none focus:border-navy" />
                  </label>
                  <label className="space-y-1.5 text-[12px] font-semibold text-ink-2">
                    Velocity / bank reference
                    <input name="reference" required placeholder="Settlement ref, bank ref, or trace" className="w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-[14px] font-medium text-ink outline-none focus:border-navy" />
                  </label>
                </div>
                <label className="space-y-1.5 text-[12px] font-semibold text-ink-2">
                  Event (optional)
                  <select name="eventId" defaultValue="" className="w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-[14px] font-medium text-ink outline-none focus:border-navy">
                    <option value="">Platform-wide (not tied to one event)</option>
                    {velocityReport.events.map((event) => (
                      <option key={event.eventId} value={event.eventId}>{event.eventTitle}</option>
                    ))}
                  </select>
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="space-y-1.5 text-[12px] font-semibold text-ink-2">
                    Period start
                    <input name="periodStart" type="date" className="w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-[14px] font-medium text-ink outline-none focus:border-navy" />
                  </label>
                  <label className="space-y-1.5 text-[12px] font-semibold text-ink-2">
                    Period end
                    <input name="periodEnd" type="date" className="w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-[14px] font-medium text-ink outline-none focus:border-navy" />
                  </label>
                </div>
                <label className="space-y-1.5 text-[12px] font-semibold text-ink-2">
                  Notes
                  <textarea name="notes" rows={2} placeholder="Optional note for finance/audit" className="w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-[14px] font-medium text-ink outline-none focus:border-navy" />
                </label>
                <button type="submit" className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-navy px-4 py-3 text-[13px] font-semibold text-white transition hover:bg-ink">
                  <ReceiptText size={14} /> Save Velocity deposit
                </button>
              </form>
            </div>

            <div className="overflow-hidden rounded-2xl border border-line bg-paper">
              <div className="border-b border-line bg-paper-2 px-5 py-3">
                <p className="text-[13px] font-bold text-ink">Velocity deposits entered</p>
                <p className="text-[12px] text-ink-3">These actual deposits reduce the “not yet matched” figure in the report sent to Velocity.</p>
              </div>
              {velocityReport.settlements.length === 0 ? (
                <div className="p-5">
                  <EmptyState
                    icon={ReceiptText}
                    title="No Velocity deposits entered"
                    body="Once Velocity pays into your account, enter the amount and reference here."
                    variant="card"
                  />
                </div>
              ) : (
                <div className="divide-y divide-line">
                  {velocityReport.settlements.slice(0, 8).map((settlement) => (
                    <div key={settlement.id} className="flex items-center justify-between gap-4 px-5 py-4">
                      <div className="min-w-0">
                        <p className="text-[14px] font-bold text-ink">{formatCurrency(settlement.amount, settlement.currency)}</p>
                        <p className="mt-0.5 truncate text-[12px] text-ink-3">
                          {settlement.reference} · paid {formatDateShort(settlement.settlementDate)}
                          {settlement.eventTitle ? ` · ${settlement.eventTitle}` : " · platform-wide"}
                        </p>
                        {(settlement.periodStart || settlement.periodEnd || settlement.notes) && (
                          <p className="mt-0.5 truncate text-[11px] text-ink-3">
                            {[settlement.periodStart ? `from ${formatDateShort(settlement.periodStart)}` : null, settlement.periodEnd ? `to ${formatDateShort(settlement.periodEnd)}` : null, settlement.notes].filter(Boolean).join(" · ")}
                          </p>
                        )}
                      </div>
                      <form action={deleteVelocitySettlementAction}>
                        <input type="hidden" name="settlementId" value={settlement.id} />
                        <button type="submit" className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-line text-ink-3 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700" title="Delete settlement">
                          <Trash2 size={14} />
                        </button>
                      </form>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {velocityReport.failureBreakdown.length > 0 && (
            <div className="rounded-2xl border border-line bg-paper p-5">
              <div className="mb-4 flex items-center gap-2">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-rose-50">
                  <AlertTriangle size={15} className="text-rose-700" />
                </span>
                <div>
                  <p className="text-[14px] font-bold tracking-tight text-ink">Why Velocity orders never completed</p>
                  <p className="text-[12px] text-ink-3">Breakdown of unpaid Velocity orders by failure cause — spot systemic gateway issues at a glance.</p>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {velocityReport.failureBreakdown.map((item) => (
                  <div key={item.category} className="rounded-xl border border-line bg-paper-2 px-4 py-3">
                    <p className="text-[20px] font-bold tabular-nums text-ink">{item.count}</p>
                    <p className="mt-0.5 text-[12px] text-ink-2">{item.label}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="overflow-hidden rounded-2xl border border-line bg-paper">
            <div className="flex items-center justify-between border-b border-line bg-paper-2 px-5 py-3">
              <div>
                <p className="text-[13px] font-bold text-ink">Event settlement report</p>
                <p className="text-[12px] text-ink-3">Generated {formatDateShort(velocityReport.generatedAt)}</p>
              </div>
              <span className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase ${
                velocityReport.totals.variance === 0 ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
              }`}>
                Variance {formatCurrency(velocityReport.totals.variance, "USD")}
              </span>
            </div>
            {velocityReport.events.length === 0 ? (
              <div className="p-5">
                <EmptyState
                  icon={Banknote}
                  title="No Velocity receipts yet"
                  body="Settled Velocity payments will appear here once checkout payments are recorded."
                  variant="card"
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[980px]">
                  <thead>
                    <tr className="border-b border-line text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-3">
                      <th className="px-5 py-3 text-left">Event</th>
                      <th className="px-3 py-3 text-right">Velocity</th>
                      <th className="px-3 py-3 text-right">Deposited</th>
                      <th className="px-3 py-3 text-right">Fee</th>
                      <th className="px-3 py-3 text-right">Net</th>
                      <th className="px-3 py-3 text-right">Paid out</th>
                      <th className="px-3 py-3 text-right">Pending</th>
                      <th className="px-3 py-3 text-right">Available</th>
                      <th className="px-5 py-3 text-right">Flags</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {velocityReport.events.slice(0, 12).map((event) => (
                      <tr key={event.eventId} className="hover:bg-paper-2/60">
                        <td className="px-5 py-4">
                          <p className="text-[14px] font-bold tracking-tight text-ink">{event.eventTitle}</p>
                          <p className="mt-0.5 text-[12px] text-ink-3">
                            {event.organizerName ?? event.organizerEmail ?? "Organizer"} · {event.paidOrders} order{event.paidOrders === 1 ? "" : "s"} · {event.confirmedTickets} ticket{event.confirmedTickets === 1 ? "" : "s"}
                          </p>
                        </td>
                        <td className="px-3 py-4 text-right text-[13px] font-bold text-ink">{formatCurrency(event.velocityReceived, event.currency)}</td>
                        <td className={`px-3 py-4 text-right text-[13px] font-semibold ${event.velocityPaidToTicketPulse >= event.velocityReceived ? "text-emerald-700" : "text-amber-700"}`}>{formatCurrency(event.velocityPaidToTicketPulse, event.currency)}</td>
                        <td className="px-3 py-4 text-right text-[13px] text-ink-2">{formatCurrency(event.platformFee, event.currency)}</td>
                        <td className="px-3 py-4 text-right text-[13px] font-semibold text-ink">{formatCurrency(event.organizerNet, event.currency)}</td>
                        <td className="px-3 py-4 text-right text-[13px] text-ink-2">{formatCurrency(event.paidOut, event.currency)}</td>
                        <td className="px-3 py-4 text-right text-[13px] text-ink-2">{formatCurrency(event.pendingPayouts, event.currency)}</td>
                        <td className="px-3 py-4 text-right text-[13px] font-bold text-ink">{formatCurrency(event.availableBalance, event.currency)}</td>
                        <td className="px-5 py-4 text-right">
                          <span className={`rounded-full px-2 py-1 text-[11px] font-bold ${
                            event.issueCount > 0 ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"
                          }`}>
                            {event.issueCount}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        <div className="grid gap-3 md:grid-cols-4">
          {[
            { label: "Orders checked", value: orderRows.length.toLocaleString(), icon: CheckCircle2, tone: "text-navy", bg: "bg-blue-50" },
            { label: "Orders with issues", value: findings.length.toLocaleString(), icon: ShieldAlert, tone: "text-amber-700", bg: "bg-amber-50" },
            { label: "Critical issues", value: criticalIssues.toLocaleString(), icon: AlertTriangle, tone: "text-rose-700", bg: "bg-rose-50" },
            { label: "Warnings", value: warningIssues.toLocaleString(), icon: TicketCheck, tone: "text-violet-700", bg: "bg-violet-50" },
          ].map(({ label, value, icon: Icon, tone, bg }) => (
            <div key={label} className="rounded-2xl border border-line bg-paper p-5">
              <div className="flex items-center gap-2 mb-3">
                <span className={`inline-flex h-8 w-8 items-center justify-center rounded-lg ${bg}`}>
                  <Icon size={15} className={tone} />
                </span>
                <span className="text-[12px] font-medium text-ink-3">{label}</span>
              </div>
              <p className={`text-[26px] font-bold tracking-tight tabular-nums ${tone}`}>{value}</p>
            </div>
          ))}
        </div>

        <div className="rounded-2xl border border-line bg-paper p-4">
          <form className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="relative w-full md:max-w-sm">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
              <input
                name="q"
                defaultValue={query}
                placeholder="Search order, buyer, event..."
                className="w-full rounded-xl border border-line bg-paper py-2.5 pl-9 pr-3 text-[14px] outline-none transition focus:border-navy"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {SEVERITY_FILTERS.map((filter) => (
                <Link
                  key={filter.value}
                  href={`/admin/reconciliation?severity=${filter.value}${query ? `&q=${encodeURIComponent(query)}` : ""}`}
                  className={`rounded-lg px-3 py-2 text-[13px] font-medium transition ${
                    severityFilter === filter.value
                      ? "bg-navy text-white"
                      : "bg-paper-2 text-ink-2 hover:text-ink"
                  }`}
                >
                  {filter.label}
                </Link>
              ))}
              <button className="rounded-lg bg-brand-600 px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-brand-700">
                Search
              </button>
            </div>
          </form>
        </div>

        {findings.length === 0 ? (
          <EmptyState
            icon={CheckCircle2}
            title="No reconciliation issues found"
            body="The checked orders currently agree with payment ledger and ticket delivery rules."
            variant="card"
          />
        ) : (
          <div className="overflow-hidden rounded-2xl border border-line bg-paper">
            <div className="grid grid-cols-[1.2fr_0.9fr_0.8fr_1.5fr] gap-4 border-b border-line bg-paper-2 px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-3 max-lg:hidden">
              <span>Order</span>
              <span>Money</span>
              <span>Tickets</span>
              <span>Issues</span>
            </div>
            <div className="divide-y divide-line">
              {findings.map((finding) => (
                <div key={finding.order.id} className="grid gap-4 px-5 py-4 lg:grid-cols-[1.2fr_0.9fr_0.8fr_1.5fr]">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Link href={`/admin/orders/${finding.order.id}`} className="font-mono text-[12px] font-semibold text-navy hover:underline">
                        {finding.order.id.slice(0, 8)}
                      </Link>
                      <span className="rounded-full bg-paper-2 px-2 py-0.5 text-[10px] font-semibold text-ink-3">
                        {finding.order.status ?? "unknown"}
                      </span>
                    </div>
                    <p className="mt-1 truncate text-[13px] font-semibold text-ink">{finding.order.eventTitle ?? "Unknown event"}</p>
                    <p className="mt-0.5 truncate text-[12px] text-ink-3">{finding.order.guestEmail ?? finding.order.guestName ?? "Guest"}</p>
                    <p className="mt-1 text-[11px] text-ink-3">{finding.order.createdAt ? formatDateShort(finding.order.createdAt) : "Unknown date"}</p>
                  </div>

                  <div className="text-[13px]">
                    <p className="font-bold text-ink">{formatCurrency(Number(finding.order.totalAmount ?? 0), finding.order.currency ?? "USD")}</p>
                    <p className="mt-1 text-ink-3">Ledger rows: {finding.ledgerRows}</p>
                    <p className="text-ink-3">Settled: {finding.settledLedgerRows}</p>
                    <Link href={`/admin/velocity?q=${finding.order.id}`} className="mt-2 inline-flex items-center gap-1 text-[12px] font-semibold text-navy hover:underline">
                      Velocity <ExternalLink size={11} />
                    </Link>
                  </div>

                  <div className="text-[13px]">
                    <p className="font-semibold text-ink">{finding.activeTickets}/{finding.expectedTickets} active</p>
                    <p className="mt-1 text-ink-3">Issued: {finding.issuedTickets}</p>
                  </div>

                  <div className="space-y-2">
                    {finding.issues.map((issue, index) => (
                      <div
                        key={`${issue.code}-${index}`}
                        className={`rounded-xl border px-3 py-2 ${
                          issue.severity === "critical"
                            ? "border-rose-200 bg-rose-50 text-rose-800"
                            : "border-amber-200 bg-amber-50 text-amber-800"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[12px] font-bold">{issue.title}</p>
                          <span className="rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-semibold uppercase">
                            {issue.area}
                          </span>
                        </div>
                        <p className="mt-1 text-[12px] leading-relaxed opacity-90">{issue.detail}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
