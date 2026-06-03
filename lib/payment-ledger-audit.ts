import type { VelocityOrderMetadata } from "@/types/velocity"

export type PaymentAuditSeverity = "warning" | "critical"

export type PaymentAuditIssue = {
  code:
    | "MULTIPLE_PAID_LEDGER_ROWS"
    | "MANUAL_LEDGER_ON_VELOCITY_ORDER"
    | "PAID_ORDER_MISSING_LEDGER"
    | "PENDING_WITH_PAID_SIGNAL"
    | "TRANSACTION_TRACE_MISMATCH"
    | "SALES_ORDER_TRACE_MISMATCH"
    | "INVOICE_MISMATCH"
    | "AMOUNT_MISMATCH"
    | "CURRENCY_MISMATCH"
    | "PAID_ORDER_MISSING_TICKETS"
    | "TICKET_COUNT_MISMATCH"
    | "TICKETS_WITHOUT_SETTLED_PAYMENT"
    | "DELIVERY_NOT_STARTED"
    | "DELIVERY_FAILED"
  severity: PaymentAuditSeverity
  title: string
  detail: string
}

export type AuditableOrder = {
  id: string
  status: string | null
  totalAmount: string | number | null
  currency: string | null
  paymentRef: string | null
  metadata: unknown
}

export type AuditableLedgerEntry = {
  transactionTrace: string
  salesOrderTrace: string
  invoiceId: string | null
  amount: string | number | null
  currency: string | null
  processor: string
  velocityPollStatus: string | null
  localStatus: string
  source: string
}

function readVelocity(metadata: unknown): VelocityOrderMetadata | null {
  if (!metadata || typeof metadata !== "object") return null
  const velocity = (metadata as { velocity?: unknown }).velocity
  return velocity && typeof velocity === "object" ? velocity as VelocityOrderMetadata : null
}

function normalizedAmount(value: string | number | null | undefined): number {
  const amount = Number(value ?? 0)
  return Number.isFinite(amount) ? Number(amount.toFixed(2)) : 0
}

function nonEmpty(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

export function auditOrderPaymentLedger(
  order: AuditableOrder,
  ledgerEntries: AuditableLedgerEntry[],
): PaymentAuditIssue[] {
  const issues: PaymentAuditIssue[] = []
  const velocity = readVelocity(order.metadata)
  const orderAmount = normalizedAmount(order.totalAmount)
  const orderCurrency = order.currency ?? "USD"
  const settledLedgerEntries = ledgerEntries.filter((entry) => entry.localStatus === "paid" || entry.localStatus === "completed")
  const velocitySettledLedgerEntries = settledLedgerEntries.filter((entry) => entry.processor === "velocity")
  const hasPaidSignal =
    settledLedgerEntries.length > 0 ||
    velocity?.pollStatus === "SUCCESS" ||
    velocity?.paymentStatus === "SUCCESS"

  if (settledLedgerEntries.length > 1) {
    issues.push({
      code: "MULTIPLE_PAID_LEDGER_ROWS",
      severity: "critical",
      title: "Multiple settled ledger entries",
      detail: `This order has ${settledLedgerEntries.length} paid/completed payment ledger rows. Check for duplicate payment handling before reporting revenue or issuing replacement tickets.`,
    })
  }

  if (velocity && settledLedgerEntries.some((entry) => entry.processor === "manual")) {
    issues.push({
      code: "MANUAL_LEDGER_ON_VELOCITY_ORDER",
      severity: "warning",
      title: "Manual completion on Velocity order",
      detail: "This order has Velocity metadata but was settled through a manual ledger entry. Confirm the gateway payment before treating it as Velocity revenue.",
    })
  }

  if ((order.status === "paid" || order.status === "completed") && settledLedgerEntries.length === 0) {
    issues.push({
      code: "PAID_ORDER_MISSING_LEDGER",
      severity: "warning",
      title: "Paid order has no paid ledger entry",
      detail: "The order is marked paid locally, but payment_ledger has no paid row for it.",
    })
  }

  if (order.status === "pending" && hasPaidSignal) {
    issues.push({
      code: "PENDING_WITH_PAID_SIGNAL",
      severity: "critical",
      title: "Pending order has paid payment signal",
      detail: "Velocity or the payment ledger indicates payment success, but the order is still pending.",
    })
  }

  const velocityTransactionTrace = nonEmpty(velocity?.transactionTrace)
  const ledgerTransactionTraces = new Set(velocitySettledLedgerEntries.map((entry) => nonEmpty(entry.transactionTrace)).filter(Boolean))
  if (velocityTransactionTrace && ledgerTransactionTraces.size > 0 && !ledgerTransactionTraces.has(velocityTransactionTrace)) {
    issues.push({
      code: "TRANSACTION_TRACE_MISMATCH",
      severity: "critical",
      title: "Transaction trace mismatch",
      detail: "Velocity metadata and payment_ledger point to different transaction traces.",
    })
  }

  const velocitySalesOrderTrace = nonEmpty(velocity?.salesOrderTrace)
  const ledgerSalesOrderTraces = new Set(velocitySettledLedgerEntries.map((entry) => nonEmpty(entry.salesOrderTrace)).filter(Boolean))
  if (velocitySalesOrderTrace && ledgerSalesOrderTraces.size > 0 && !ledgerSalesOrderTraces.has(velocitySalesOrderTrace)) {
    issues.push({
      code: "SALES_ORDER_TRACE_MISMATCH",
      severity: "critical",
      title: "Sales order trace mismatch",
      detail: "Velocity metadata and payment_ledger point to different sales order traces.",
    })
  }

  const expectedInvoice = nonEmpty(order.paymentRef) ?? nonEmpty(velocity?.invoiceRef) ?? nonEmpty(velocity?.paymentRef)
  const ledgerInvoices = new Set(settledLedgerEntries.map((entry) => nonEmpty(entry.invoiceId)).filter(Boolean))
  if (expectedInvoice && ledgerInvoices.size > 0 && !ledgerInvoices.has(expectedInvoice)) {
    issues.push({
      code: "INVOICE_MISMATCH",
      severity: "warning",
      title: "Invoice mismatch",
      detail: "The order payment reference or Velocity invoice does not match payment_ledger.",
    })
  }

  for (const entry of settledLedgerEntries) {
    const ledgerAmount = normalizedAmount(entry.amount)
    if (ledgerAmount !== orderAmount) {
      issues.push({
        code: "AMOUNT_MISMATCH",
        severity: "critical",
        title: "Paid amount mismatch",
        detail: `Ledger amount ${ledgerAmount.toFixed(2)} does not match order amount ${orderAmount.toFixed(2)}.`,
      })
    }

    if ((entry.currency ?? "USD") !== orderCurrency) {
      issues.push({
        code: "CURRENCY_MISMATCH",
        severity: "critical",
        title: "Currency mismatch",
        detail: `Ledger currency ${entry.currency ?? "USD"} does not match order currency ${orderCurrency}.`,
      })
    }
  }

  return issues
}
