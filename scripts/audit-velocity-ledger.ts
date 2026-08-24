/**
 * Audit Velocity order metadata against payment_ledger.
 *
 * Usage:
 *   DATABASE_URL="postgresql://..." npx tsx scripts/audit-velocity-ledger.ts
 *   DATABASE_URL="postgresql://..." npx tsx scripts/audit-velocity-ledger.ts --json
 */

import "dotenv/config"
import { Pool } from "pg"
import { auditOrderPaymentLedger, type AuditableLedgerEntry } from "@/lib/payment-ledger-audit"

type OrderRow = {
  id: string
  status: string | null
  total_amount: string | null
  currency: string | null
  payment_ref: string | null
  paid_at: Date | string | null
  completed_at: Date | string | null
  guest_email: string | null
  guest_name: string | null
  event_title: string | null
  metadata: unknown
  created_at: Date | string | null
}

type LedgerRow = {
  order_id: string
  transaction_trace: string
  sales_order_trace: string
  invoice_id: string | null
  amount: string | null
  currency: string | null
  processor: string
  velocity_poll_status: string | null
  local_status: string
  source: string
  created_at: Date | string | null
}

const DATABASE_URL = process.env.DATABASE_URL
const JSON_OUTPUT = process.argv.includes("--json")

if (!DATABASE_URL) {
  console.error("DATABASE_URL is not set.")
  process.exit(1)
}

function toLedgerEntry(row: LedgerRow): AuditableLedgerEntry {
  return {
    transactionTrace: row.transaction_trace,
    salesOrderTrace: row.sales_order_trace,
    invoiceId: row.invoice_id,
    amount: row.amount,
    currency: row.currency,
    processor: row.processor,
    velocityPollStatus: row.velocity_poll_status,
    localStatus: row.local_status,
    source: row.source,
  }
}

async function main() {
  const pool = new Pool({
    connectionString: DATABASE_URL,
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 10_000,
    max: 2,
  })

  try {
    const { rows: orders } = await pool.query<OrderRow>(`
    SELECT
      o.id,
      o.status,
      o.total_amount,
      o.currency,
      o.payment_ref,
      o.paid_at,
      o.completed_at,
      o.guest_email,
      o.guest_name,
      e.title AS event_title,
      o.metadata,
      o.created_at
    FROM orders o
    LEFT JOIN events e ON e.id = o.event_id
    WHERE o.metadata->>'velocity' IS NOT NULL
    ORDER BY o.created_at DESC
    `)

    const { rows: ledgerRows } = await pool.query<LedgerRow>(`
    SELECT
      pl.order_id,
      pl.transaction_trace,
      pl.sales_order_trace,
      pl.invoice_id,
      pl.amount,
      pl.currency,
      pl.processor,
      pl.velocity_poll_status,
      pl.local_status,
      pl.source,
      pl.created_at
    FROM payment_ledger pl
    INNER JOIN orders o ON o.id = pl.order_id
    WHERE o.metadata->>'velocity' IS NOT NULL
    ORDER BY pl.created_at DESC
    `)

    const ledgerByOrder = new Map<string, LedgerRow[]>()
    for (const row of ledgerRows) {
      const list = ledgerByOrder.get(row.order_id) ?? []
      list.push(row)
      ledgerByOrder.set(row.order_id, list)
    }

    const findings = orders
    .map((order) => {
      const ledger = ledgerByOrder.get(order.id) ?? []
      const issues = auditOrderPaymentLedger(
        {
          id: order.id,
          status: order.status,
          totalAmount: order.total_amount,
          currency: order.currency,
          paymentRef: order.payment_ref,
          paidAt: order.paid_at,
          completedAt: order.completed_at,
          metadata: order.metadata,
        },
        ledger.map(toLedgerEntry),
      )

      return {
        orderId: order.id,
        status: order.status,
        buyer: order.guest_email ?? order.guest_name ?? "Guest",
        eventTitle: order.event_title ?? "Unknown event",
        amount: Number(order.total_amount ?? 0),
        currency: order.currency ?? "USD",
        createdAt: order.created_at,
        ledgerRows: ledger.length,
        settledLedgerRows: ledger.filter((row) => row.local_status === "paid" || row.local_status === "completed").length,
        issues,
      }
    })
    .filter((finding) => finding.issues.length > 0)

    const summary = {
    checkedVelocityOrders: orders.length,
    checkedLedgerRows: ledgerRows.length,
    ordersWithIssues: findings.length,
    criticalIssues: findings.reduce((sum, finding) => sum + finding.issues.filter((issue) => issue.severity === "critical").length, 0),
    warningIssues: findings.reduce((sum, finding) => sum + finding.issues.filter((issue) => issue.severity === "warning").length, 0),
  }

    if (JSON_OUTPUT) {
      console.log(JSON.stringify({ summary, findings }, null, 2))
      return
    }

    console.log("Velocity/payment ledger audit")
    console.log(JSON.stringify(summary, null, 2))

    if (findings.length === 0) {
      console.log("No mismatches found.")
      return
    }

    for (const finding of findings) {
      console.log("")
      console.log(`${finding.orderId} | ${finding.status} | ${finding.buyer} | ${finding.eventTitle}`)
      console.log(`  ${finding.currency} ${finding.amount.toFixed(2)} | ledger rows: ${finding.ledgerRows}, settled rows: ${finding.settledLedgerRows}`)
      for (const issue of finding.issues) {
        console.log(`  - [${issue.severity}] ${issue.title}: ${issue.detail}`)
      }
    }
  } finally {
    await pool.end()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
