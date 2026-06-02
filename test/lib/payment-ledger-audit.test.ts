import { describe, expect, it } from "vitest"

import { auditOrderPaymentLedger, type AuditableLedgerEntry, type AuditableOrder } from "@/lib/payment-ledger-audit"

const baseOrder: AuditableOrder = {
  id: "order-1",
  status: "paid",
  totalAmount: "25.00",
  currency: "USD",
  paymentRef: "INV-1",
  metadata: {
    velocity: {
      salesOrderTrace: "SO-1",
      transactionTrace: "TX-1",
      pollStatus: "SUCCESS",
      paymentStatus: "SUCCESS",
      paymentRef: "INV-1",
      invoiceRef: "INV-1",
    },
  },
}

const baseLedger: AuditableLedgerEntry = {
  transactionTrace: "TX-1",
  salesOrderTrace: "SO-1",
  invoiceId: "INV-1",
  amount: "25.00",
  currency: "USD",
  processor: "velocity",
  velocityPollStatus: "SUCCESS",
  localStatus: "paid",
  source: "poll",
}

describe("auditOrderPaymentLedger", () => {
  it("passes when order, Velocity metadata, and payment ledger agree", () => {
    expect(auditOrderPaymentLedger(baseOrder, [baseLedger])).toEqual([])
  })

  it("flags duplicate paid ledger rows", () => {
    const issues = auditOrderPaymentLedger(baseOrder, [
      baseLedger,
      { ...baseLedger, transactionTrace: "TX-2", source: "manual_complete" },
    ])

    expect(issues.map((issue) => issue.code)).toContain("MULTIPLE_PAID_LEDGER_ROWS")
  })

  it("flags a pending order with a paid signal", () => {
    const issues = auditOrderPaymentLedger({ ...baseOrder, status: "pending" }, [baseLedger])

    expect(issues.map((issue) => issue.code)).toContain("PENDING_WITH_PAID_SIGNAL")
  })

  it("flags trace, invoice, amount, and currency mismatches", () => {
    const issues = auditOrderPaymentLedger(baseOrder, [
      {
        ...baseLedger,
        transactionTrace: "TX-other",
        salesOrderTrace: "SO-other",
        invoiceId: "INV-other",
        amount: "30.00",
        currency: "ZWG",
      },
    ])

    expect(issues.map((issue) => issue.code)).toEqual(expect.arrayContaining([
      "TRANSACTION_TRACE_MISMATCH",
      "SALES_ORDER_TRACE_MISMATCH",
      "INVOICE_MISMATCH",
      "AMOUNT_MISMATCH",
      "CURRENCY_MISMATCH",
    ]))
  })

  it("flags a paid order with no paid ledger row", () => {
    const issues = auditOrderPaymentLedger(baseOrder, [])

    expect(issues.map((issue) => issue.code)).toContain("PAID_ORDER_MISSING_LEDGER")
  })

  it("treats completed manual ledger rows as settled but warns on Velocity orders", () => {
    const issues = auditOrderPaymentLedger(baseOrder, [
      {
        ...baseLedger,
        processor: "manual",
        localStatus: "completed",
        velocityPollStatus: "MANUAL_COMPLETE",
        transactionTrace: "manual-order-1",
        salesOrderTrace: "manual-order-1",
        invoiceId: "manual-order-1",
      },
    ])

    const codes = issues.map((issue) => issue.code)
    expect(codes).toContain("MANUAL_LEDGER_ON_VELOCITY_ORDER")
    expect(codes).not.toContain("PAID_ORDER_MISSING_LEDGER")
  })
})
