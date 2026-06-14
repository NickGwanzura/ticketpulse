import { sql } from "drizzle-orm"

import { db } from "@/db"
import type { OrdersReconReport, OrdersReconReportRow } from "@/lib/pdf/orders-report"

type OrdersReconReportInput = {
  title: string
  scope: string
  generatedBy: string
  search?: string
  status?: string
  eventIds?: string[]
}

type RawOrderRow = {
  id: string
  event_title: string | null
  guest_name: string | null
  guest_email: string | null
  guest_phone: string | null
  status: string | null
  payment_method: string | null
  payment_ref: string | null
  total_amount: string | number | null
  currency: string | null
  created_at: Date | string | null
  paid_at: Date | string | null
  metadata: unknown
  ticket_count: number | string | null
  ledger_count: number | string | null
}

function toIso(value: Date | string | null | undefined) {
  if (!value) return ""
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? "" : date.toISOString()
}

function readMetaString(metadata: unknown, path: string[]) {
  let current = metadata
  for (const key of path) {
    if (!current || typeof current !== "object") return ""
    current = (current as Record<string, unknown>)[key]
  }
  return typeof current === "string" ? current : ""
}

function deliveryStatus(metadata: unknown) {
  return readMetaString(metadata, ["delivery", "status"]) || "NOT_STARTED"
}

function normalizeOrder(row: RawOrderRow): OrdersReconReportRow {
  return {
    id: row.id,
    eventTitle: row.event_title ?? "",
    customerName: row.guest_name ?? "",
    customerEmail: row.guest_email ?? "",
    customerPhone: row.guest_phone ?? "",
    status: row.status ?? "",
    paymentMethod: row.payment_method ?? "",
    paymentRef: row.payment_ref ?? "",
    paymentTrace: readMetaString(row.metadata, ["velocity", "transactionTrace"]),
    salesOrderTrace: readMetaString(row.metadata, ["velocity", "salesOrderTrace"]),
    deliveryStatus: deliveryStatus(row.metadata),
    ticketCount: Number(row.ticket_count ?? 0),
    ledgerCount: Number(row.ledger_count ?? 0),
    amount: Number(row.total_amount ?? 0),
    currency: row.currency ?? "USD",
    createdAt: toIso(row.created_at),
    paidAt: toIso(row.paid_at),
  }
}

function isPaidStatus(status: string) {
  return status === "paid" || status === "completed"
}

function isPendingStatus(status: string) {
  return status === "pending" || status === "awaiting_verification"
}

function isVoidStatus(status: string) {
  return !isPaidStatus(status) && !isPendingStatus(status)
}

export async function getOrdersReconReport(input: OrdersReconReportInput): Promise<OrdersReconReport> {
  const clauses = []
  const search = input.search?.trim()
  const status = input.status ?? "all"

  if (input.eventIds) {
    if (input.eventIds.length === 0) {
      clauses.push(sql`false`)
    } else {
      clauses.push(sql`o.event_id IN (${sql.join(input.eventIds.map((id) => sql`${id}`), sql`, `)})`)
    }
  }

  if (search) {
    const pattern = `%${search}%`
    clauses.push(sql`(
      o.guest_email ILIKE ${pattern}
      OR o.guest_name ILIKE ${pattern}
      OR o.guest_phone ILIKE ${pattern}
      OR o.id::text ILIKE ${pattern}
      OR e.title ILIKE ${pattern}
    )`)
  }

  if (status === "pending") {
    clauses.push(sql`o.status IN ('pending', 'awaiting_verification')`)
  } else if (status !== "all") {
    clauses.push(sql`o.status = ${status}`)
  }

  const whereClause = clauses.length > 0
    ? sql`WHERE ${sql.join(clauses, sql` AND `)}`
    : sql``

  const result = await db.execute(sql`
    WITH filtered_orders AS (
      SELECT
        o.id,
        e.title AS event_title,
        o.guest_name,
        o.guest_email,
        o.guest_phone,
        o.status,
        o.payment_method,
        o.payment_ref,
        o.total_amount,
        o.currency,
        o.created_at,
        o.paid_at,
        o.metadata
      FROM orders o
      LEFT JOIN events e ON e.id = o.event_id
      ${whereClause}
      ORDER BY o.created_at DESC
    ),
    ticket_counts AS (
      SELECT order_id, COUNT(*)::int AS ticket_count
      FROM tickets
      WHERE order_id IN (SELECT id FROM filtered_orders)
        AND is_staff_ticket = false
        AND status NOT IN ('cancelled', 'refunded')
      GROUP BY order_id
    ),
    ledger_counts AS (
      SELECT order_id, COUNT(*)::int AS ledger_count
      FROM payment_ledger
      WHERE order_id IN (SELECT id FROM filtered_orders)
      GROUP BY order_id
    )
    SELECT
      filtered_orders.*,
      COALESCE(ticket_counts.ticket_count, 0)::int AS ticket_count,
      COALESCE(ledger_counts.ledger_count, 0)::int AS ledger_count
    FROM filtered_orders
    LEFT JOIN ticket_counts ON ticket_counts.order_id = filtered_orders.id
    LEFT JOIN ledger_counts ON ledger_counts.order_id = filtered_orders.id
    ORDER BY filtered_orders.created_at DESC
  `)

  const rows = (result.rows as unknown as RawOrderRow[]).map(normalizeOrder)
  const paidRows = rows.filter((row) => isPaidStatus(row.status))
  const pendingRows = rows.filter((row) => isPendingStatus(row.status))
  const voidRows = rows.filter((row) => isVoidStatus(row.status))

  return {
    title: input.title,
    generatedAt: new Date(),
    generatedBy: input.generatedBy,
    scope: input.scope,
    filters: {
      search,
      status,
    },
    totals: {
      orderCount: rows.length,
      gross: rows.reduce((sum, row) => sum + row.amount, 0),
      paidGross: paidRows.reduce((sum, row) => sum + row.amount, 0),
      pendingGross: pendingRows.reduce((sum, row) => sum + row.amount, 0),
      voidGross: voidRows.reduce((sum, row) => sum + row.amount, 0),
      paidOrders: paidRows.length,
      pendingOrders: pendingRows.length,
      voidOrders: voidRows.length,
      paidNoTickets: rows.filter((row) => isPaidStatus(row.status) && row.ticketCount === 0).length,
      duplicateLedgerOrders: rows.filter((row) => row.ledgerCount > 1).length,
      deliveryFailures: rows.filter((row) => row.deliveryStatus === "FAILED" || row.deliveryStatus === "EMAIL_FAILED").length,
    },
    rows,
  }
}
