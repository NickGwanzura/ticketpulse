import { and, desc, eq, inArray, sql } from "drizzle-orm"

import { db } from "@/db"
import { events, orders, paymentLedger, payouts, tickets, users } from "@/db/schema"
import type { VelocityOrderMetadata } from "@/types/velocity"

const PLATFORM_FEE_RATE = 0.05

const PAID_ORDER_STATUSES = new Set(["paid", "completed"])
const SETTLED_LEDGER_STATUSES = new Set(["paid", "completed", "success", "paid_success"])
const PAID_PAYOUT_STATUSES = new Set(["paid"])
const PENDING_PAYOUT_STATUSES = new Set(["pending", "approved", "processing"])

type OrderRow = {
  id: string
  eventId: string
  status: string | null
  totalAmount: string
  currency: string | null
  paymentRef: string | null
  paymentMethod: string | null
  metadata: unknown
  guestEmail: string | null
  guestName: string | null
  paidAt: Date | null
  completedAt: Date | null
  createdAt: Date | null
  eventTitle: string | null
  eventSlug: string | null
  organizerId: string | null
  organizerName: string | null
  organizerEmail: string | null
}

type LedgerRow = {
  id: string
  orderId: string
  eventId: string
  transactionTrace: string
  salesOrderTrace: string
  invoiceId: string | null
  amount: string
  currency: string | null
  processor: string
  velocityPollStatus: string | null
  localStatus: string
  source: string
  createdAt: Date | null
}

export type VelocityReconciliationIssue = {
  severity: "critical" | "warning"
  code:
    | "VELOCITY_PAID_ORDER_MISSING_LEDGER"
    | "VELOCITY_LEDGER_ORDER_NOT_PAID"
    | "DUPLICATE_SETTLED_LEDGER"
    | "AMOUNT_MISMATCH"
    | "CURRENCY_MISMATCH"
    | "TRACE_MISMATCH"
    | "INVOICE_MISMATCH"
    | "TICKETS_WITHOUT_PAID_ORDER"
    | "PAID_ORDER_WITHOUT_TICKETS"
    | "PAYOUT_OVER_NET"
  title: string
  detail: string
}

export type VelocityReconciliationEvent = {
  eventId: string
  eventTitle: string
  eventSlug: string | null
  organizerId: string | null
  organizerName: string | null
  organizerEmail: string | null
  currency: string
  velocityReceived: number
  localPaidRevenue: number
  variance: number
  platformFee: number
  organizerNet: number
  paidOut: number
  pendingPayouts: number
  availableBalance: number
  paidOrders: number
  settledVelocityRows: number
  confirmedTickets: number
  issueCount: number
}

export type VelocityReconciliationOrder = {
  orderId: string
  eventId: string
  eventTitle: string
  buyer: string
  status: string | null
  currency: string
  orderTotal: number
  velocityLedgerTotal: number
  variance: number
  transactionTrace: string | null
  salesOrderTrace: string | null
  invoiceId: string | null
  processor: string | null
  localStatus: string | null
  velocityPollStatus: string | null
  createdAt: Date | null
  issues: VelocityReconciliationIssue[]
}

export type VelocityReconciliationReport = {
  generatedAt: Date
  feeRate: number
  totals: {
    velocityReceived: number
    localPaidRevenue: number
    variance: number
    platformFee: number
    organizerNet: number
    paidOut: number
    pendingPayouts: number
    availableBalance: number
    paidOrders: number
    settledVelocityRows: number
    confirmedTickets: number
    criticalIssues: number
    warningIssues: number
  }
  events: VelocityReconciliationEvent[]
  orders: VelocityReconciliationOrder[]
}

function money(value: unknown): number {
  const n = Number(value ?? 0)
  return Number.isFinite(n) ? Number(n.toFixed(2)) : 0
}

function addMoney(a: number, b: number): number {
  return money(a + b)
}

function isPaidOrder(status: string | null | undefined) {
  return PAID_ORDER_STATUSES.has((status ?? "").toLowerCase())
}

function isSettledLedger(status: string | null | undefined) {
  return SETTLED_LEDGER_STATUSES.has((status ?? "").toLowerCase())
}

function isVelocityProcessor(processor: string | null | undefined) {
  return (processor ?? "").toLowerCase() === "velocity"
}

function readVelocity(metadata: unknown): VelocityOrderMetadata | null {
  if (!metadata || typeof metadata !== "object") return null
  const velocity = (metadata as { velocity?: unknown }).velocity
  return velocity && typeof velocity === "object" ? (velocity as VelocityOrderMetadata) : null
}

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function issue(
  severity: VelocityReconciliationIssue["severity"],
  code: VelocityReconciliationIssue["code"],
  title: string,
  detail: string,
): VelocityReconciliationIssue {
  return { severity, code, title, detail }
}

function csvCell(value: unknown): string {
  const raw = value instanceof Date ? value.toISOString() : String(value ?? "")
  return /[",\n]/.test(raw) ? `"${raw.replaceAll('"', '""')}"` : raw
}

export async function getVelocityReconciliationReport(): Promise<VelocityReconciliationReport> {
  const hasVelocity = sql`${orders.metadata}->>'velocity' IS NOT NULL`

  const orderRows = await db
    .select({
      id: orders.id,
      eventId: orders.eventId,
      status: orders.status,
      totalAmount: orders.totalAmount,
      currency: orders.currency,
      paymentRef: orders.paymentRef,
      paymentMethod: orders.paymentMethod,
      metadata: orders.metadata,
      guestEmail: orders.guestEmail,
      guestName: orders.guestName,
      paidAt: orders.paidAt,
      completedAt: orders.completedAt,
      createdAt: orders.createdAt,
      eventTitle: events.title,
      eventSlug: events.slug,
      organizerId: events.organizerId,
      organizerName: users.name,
      organizerEmail: users.email,
    })
    .from(orders)
    .leftJoin(events, eq(events.id, orders.eventId))
    .leftJoin(users, eq(users.id, events.organizerId))
    .where(hasVelocity)
    .orderBy(desc(orders.createdAt))

  const orderIds = orderRows.map((row) => row.id)
  const eventIds = [...new Set(orderRows.map((row) => row.eventId))]

  const [ledgerRows, ticketRows, payoutRows] = orderIds.length > 0
    ? await Promise.all([
        db
          .select({
            id: paymentLedger.id,
            orderId: paymentLedger.orderId,
            eventId: paymentLedger.eventId,
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
            eventId: tickets.eventId,
            count: sql<number>`COUNT(*)::int`,
          })
          .from(tickets)
          .where(and(inArray(tickets.orderId, orderIds), sql`${tickets.status} NOT IN ('cancelled', 'refunded')`))
          .groupBy(tickets.orderId, tickets.eventId),
        eventIds.length > 0
          ? db
              .select({
                eventId: payouts.eventId,
                amount: payouts.amount,
                status: payouts.status,
              })
              .from(payouts)
              .where(inArray(payouts.eventId, eventIds))
          : Promise.resolve([]),
      ])
    : [[], [], []]

  const ledgerByOrder = new Map<string, LedgerRow[]>()
  for (const row of ledgerRows) {
    const rows = ledgerByOrder.get(row.orderId) ?? []
    rows.push(row)
    ledgerByOrder.set(row.orderId, rows)
  }

  const ticketsByOrder = new Map<string, number>()
  for (const row of ticketRows) {
    if (!row.orderId) continue
    ticketsByOrder.set(row.orderId, (ticketsByOrder.get(row.orderId) ?? 0) + Number(row.count ?? 0))
  }

  const payoutsByEvent = new Map<string, { paid: number; pending: number }>()
  for (const row of payoutRows) {
    if (!row.eventId) continue
    const current = payoutsByEvent.get(row.eventId) ?? { paid: 0, pending: 0 }
    const status = (row.status ?? "").toLowerCase()
    if (PAID_PAYOUT_STATUSES.has(status)) current.paid = addMoney(current.paid, money(row.amount))
    if (PENDING_PAYOUT_STATUSES.has(status)) current.pending = addMoney(current.pending, money(row.amount))
    payoutsByEvent.set(row.eventId, current)
  }

  const eventMap = new Map<string, VelocityReconciliationEvent>()
  const orderReports: VelocityReconciliationOrder[] = []

  for (const order of orderRows as OrderRow[]) {
    const velocity = readVelocity(order.metadata)
    const ledger = (ledgerByOrder.get(order.id) ?? []).filter((row) => isVelocityProcessor(row.processor))
    const settledLedger = ledger.filter((row) => isSettledLedger(row.localStatus))
    const settledTotal = settledLedger.reduce((sum, row) => addMoney(sum, money(row.amount)), 0)
    const orderTotal = money(order.totalAmount)
    const paid = isPaidOrder(order.status)
    const ticketCount = ticketsByOrder.get(order.id) ?? 0
    const currency = order.currency ?? settledLedger[0]?.currency ?? "USD"
    const issues: VelocityReconciliationIssue[] = []

    if (paid && settledLedger.length === 0) {
      issues.push(issue(
        "critical",
        "VELOCITY_PAID_ORDER_MISSING_LEDGER",
        "Velocity paid order missing ledger",
        "The order has Velocity metadata and is paid/completed locally, but no settled Velocity ledger row exists.",
      ))
    }

    if (!paid && settledLedger.length > 0) {
      issues.push(issue(
        "critical",
        "VELOCITY_LEDGER_ORDER_NOT_PAID",
        "Velocity money received but order not paid",
        "The payment ledger says Velocity settled this order, but the order is not marked paid/completed.",
      ))
    }

    if (settledLedger.length > 1) {
      issues.push(issue(
        "critical",
        "DUPLICATE_SETTLED_LEDGER",
        "Duplicate settled Velocity ledger rows",
        `This order has ${settledLedger.length} settled Velocity ledger rows. Treat revenue with caution until one payment truth is confirmed.`,
      ))
    }

    if (paid && settledLedger.length > 0 && settledTotal !== orderTotal) {
      issues.push(issue(
        "critical",
        "AMOUNT_MISMATCH",
        "Velocity amount does not match order total",
        `Velocity settled ${settledTotal.toFixed(2)} but the order total is ${orderTotal.toFixed(2)}.`,
      ))
    }

    for (const row of settledLedger) {
      if ((row.currency ?? "USD") !== currency) {
        issues.push(issue(
          "critical",
          "CURRENCY_MISMATCH",
          "Velocity currency mismatch",
          `Ledger currency ${row.currency ?? "USD"} does not match order currency ${currency}.`,
        ))
      }
    }

    const velocityTrace = clean(velocity?.transactionTrace)
    const ledgerTraces = new Set(settledLedger.map((row) => clean(row.transactionTrace)).filter(Boolean))
    if (velocityTrace && ledgerTraces.size > 0 && !ledgerTraces.has(velocityTrace)) {
      issues.push(issue(
        "critical",
        "TRACE_MISMATCH",
        "Velocity trace mismatch",
        "Order Velocity metadata and settled payment ledger rows point to different transaction traces.",
      ))
    }

    const expectedInvoice = clean(order.paymentRef) ?? clean(velocity?.invoiceRef) ?? clean(velocity?.paymentRef)
    const ledgerInvoices = new Set(settledLedger.map((row) => clean(row.invoiceId)).filter(Boolean))
    if (expectedInvoice && ledgerInvoices.size > 0 && !ledgerInvoices.has(expectedInvoice)) {
      issues.push(issue(
        "warning",
        "INVOICE_MISMATCH",
        "Velocity invoice mismatch",
        "Order payment reference and payment ledger invoice do not agree.",
      ))
    }

    if (!paid && ticketCount > 0) {
      issues.push(issue(
        "critical",
        "TICKETS_WITHOUT_PAID_ORDER",
        "Tickets exist without paid order",
        "Active tickets exist for a Velocity order that is not locally paid/completed.",
      ))
    }

    if (paid && orderTotal > 0 && ticketCount === 0) {
      issues.push(issue(
        "warning",
        "PAID_ORDER_WITHOUT_TICKETS",
        "Paid order has no active tickets",
        "The paid Velocity order has no active ticket rows attached.",
      ))
    }

    const mainLedger = settledLedger[0] ?? ledger[0] ?? null
    const eventTitle = order.eventTitle ?? "Unknown event"
    const paidOrderRevenue = paid ? orderTotal : 0

    const eventReport = eventMap.get(order.eventId) ?? {
      eventId: order.eventId,
      eventTitle,
      eventSlug: order.eventSlug,
      organizerId: order.organizerId,
      organizerName: order.organizerName,
      organizerEmail: order.organizerEmail,
      currency,
      velocityReceived: 0,
      localPaidRevenue: 0,
      variance: 0,
      platformFee: 0,
      organizerNet: 0,
      paidOut: 0,
      pendingPayouts: 0,
      availableBalance: 0,
      paidOrders: 0,
      settledVelocityRows: 0,
      confirmedTickets: 0,
      issueCount: 0,
    }

    eventReport.velocityReceived = addMoney(eventReport.velocityReceived, settledTotal)
    eventReport.localPaidRevenue = addMoney(eventReport.localPaidRevenue, paidOrderRevenue)
    eventReport.paidOrders += paid ? 1 : 0
    eventReport.settledVelocityRows += settledLedger.length
    eventReport.confirmedTickets += paid ? ticketCount : 0
    eventReport.issueCount += issues.length
    eventMap.set(order.eventId, eventReport)

    orderReports.push({
      orderId: order.id,
      eventId: order.eventId,
      eventTitle,
      buyer: order.guestEmail ?? order.guestName ?? "Guest",
      status: order.status,
      currency,
      orderTotal,
      velocityLedgerTotal: settledTotal,
      variance: money(settledTotal - paidOrderRevenue),
      transactionTrace: mainLedger?.transactionTrace ?? velocityTrace,
      salesOrderTrace: mainLedger?.salesOrderTrace ?? clean(velocity?.salesOrderTrace),
      invoiceId: mainLedger?.invoiceId ?? expectedInvoice,
      processor: mainLedger?.processor ?? null,
      localStatus: mainLedger?.localStatus ?? null,
      velocityPollStatus: mainLedger?.velocityPollStatus ?? velocity?.pollStatus ?? null,
      createdAt: order.paidAt ?? order.completedAt ?? order.createdAt,
      issues,
    })
  }

  const eventsReport = [...eventMap.values()].map((event) => {
    const payoutsForEvent = payoutsByEvent.get(event.eventId) ?? { paid: 0, pending: 0 }
    const platformFee = money(event.velocityReceived * PLATFORM_FEE_RATE)
    const organizerNet = money(event.velocityReceived - platformFee)
    const availableBalance = money(Math.max(0, organizerNet - payoutsForEvent.paid - payoutsForEvent.pending))
    const issues = [...orderReports]
      .filter((order) => order.eventId === event.eventId)
      .flatMap((order) => order.issues)

    if (payoutsForEvent.paid + payoutsForEvent.pending > organizerNet) {
      issues.push(issue(
        "critical",
        "PAYOUT_OVER_NET",
        "Payouts exceed net Velocity receipts",
        "Paid and pending payouts are greater than the event net after TicketPulse fee.",
      ))
    }

    return {
      ...event,
      variance: money(event.velocityReceived - event.localPaidRevenue),
      platformFee,
      organizerNet,
      paidOut: payoutsForEvent.paid,
      pendingPayouts: payoutsForEvent.pending,
      availableBalance,
      issueCount: issues.length,
    }
  }).sort((a, b) => b.velocityReceived - a.velocityReceived)

  const criticalIssues = orderReports.reduce((sum, order) => sum + order.issues.filter((item) => item.severity === "critical").length, 0)
  const warningIssues = orderReports.reduce((sum, order) => sum + order.issues.filter((item) => item.severity === "warning").length, 0)

  const totals = eventsReport.reduce(
    (acc, event) => ({
      velocityReceived: addMoney(acc.velocityReceived, event.velocityReceived),
      localPaidRevenue: addMoney(acc.localPaidRevenue, event.localPaidRevenue),
      variance: addMoney(acc.variance, event.variance),
      platformFee: addMoney(acc.platformFee, event.platformFee),
      organizerNet: addMoney(acc.organizerNet, event.organizerNet),
      paidOut: addMoney(acc.paidOut, event.paidOut),
      pendingPayouts: addMoney(acc.pendingPayouts, event.pendingPayouts),
      availableBalance: addMoney(acc.availableBalance, event.availableBalance),
      paidOrders: acc.paidOrders + event.paidOrders,
      settledVelocityRows: acc.settledVelocityRows + event.settledVelocityRows,
      confirmedTickets: acc.confirmedTickets + event.confirmedTickets,
      criticalIssues,
      warningIssues,
    }),
    {
      velocityReceived: 0,
      localPaidRevenue: 0,
      variance: 0,
      platformFee: 0,
      organizerNet: 0,
      paidOut: 0,
      pendingPayouts: 0,
      availableBalance: 0,
      paidOrders: 0,
      settledVelocityRows: 0,
      confirmedTickets: 0,
      criticalIssues,
      warningIssues,
    },
  )

  return {
    generatedAt: new Date(),
    feeRate: PLATFORM_FEE_RATE,
    totals,
    events: eventsReport,
    orders: orderReports,
  }
}

export function velocityReconciliationToCsv(report: VelocityReconciliationReport): string {
  const rows = [
    [
      "event",
      "order_id",
      "buyer",
      "status",
      "currency",
      "order_total",
      "velocity_received",
      "variance",
      "transaction_trace",
      "sales_order_trace",
      "invoice_id",
      "local_status",
      "velocity_poll_status",
      "issues",
      "checked_at",
    ],
    ...report.orders.map((order) => [
      order.eventTitle,
      order.orderId,
      order.buyer,
      order.status ?? "",
      order.currency,
      order.orderTotal.toFixed(2),
      order.velocityLedgerTotal.toFixed(2),
      order.variance.toFixed(2),
      order.transactionTrace ?? "",
      order.salesOrderTrace ?? "",
      order.invoiceId ?? "",
      order.localStatus ?? "",
      order.velocityPollStatus ?? "",
      order.issues.map((item) => `${item.severity}:${item.code}`).join("; "),
      report.generatedAt,
    ]),
  ]

  return rows.map((row) => row.map(csvCell).join(",")).join("\n")
}
