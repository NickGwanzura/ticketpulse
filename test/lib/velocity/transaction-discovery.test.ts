import { describe, expect, it } from "vitest"

import { selectVelocityTransaction } from "@/services/velocity"

describe("Velocity transaction discovery", () => {
  it("selects the newest exact sales-order transaction", () => {
    const result = selectVelocityTransaction([
      {
        id: "old",
        trace: "old-trace",
        createdAt: "2026-09-10T10:00:00.000Z",
        orderAmount: 1,
        paymentProcessorLabel: "ECOCASH",
        debitPhone: "+263777816368",
        salesOrderId: "sales-order-1",
        pollStatus: "SUCCESS",
      },
      {
        id: "new",
        trace: "new-trace",
        createdAt: "2026-09-10T11:00:00.000Z",
        orderAmount: 1,
        paymentProcessorLabel: "ECOCASH",
        debitPhone: "0777816368",
        debitRef: "MP260910.1626.T8210525",
        salesOrderId: "sales-order-1",
        pollStatus: "SUCCESS",
      },
      {
        id: "wrong-order",
        trace: "wrong-order-trace",
        createdAt: "2026-09-10T12:00:00.000Z",
        orderAmount: 1,
        paymentProcessorLabel: "ECOCASH",
        debitPhone: "0777816368",
        salesOrderId: "sales-order-2",
        pollStatus: "SUCCESS",
      },
    ], {
      salesOrderId: "sales-order-1",
      amount: 1,
      paymentProcessor: "ECOCASH",
      debitPhone: "0777816368",
    })

    expect(result?.id).toBe("new")
    expect(result?.trace).toBe("new-trace")
  })

  it("rejects amount, processor, and phone mismatches", () => {
    const result = selectVelocityTransaction([
      {
        id: "mismatch",
        trace: "mismatch-trace",
        orderAmount: 5,
        paymentProcessorLabel: "VMC",
        debitPhone: "+263771234567",
        salesOrderId: "sales-order-1",
      },
    ], {
      salesOrderId: "sales-order-1",
      amount: 1,
      paymentProcessor: "ECOCASH",
      debitPhone: "0777816368",
    })

    expect(result).toBeNull()
  })

  it("normalizes provider Visa/Mastercard labels to VMC", () => {
    const result = selectVelocityTransaction([
      {
        id: "vmc",
        trace: "vmc-trace",
        orderAmount: 40,
        paymentProcessorLabel: "Visa / Mastercard",
        debitPhone: "263777816368",
        salesOrderId: "sales-order-vmc",
      },
    ], {
      salesOrderId: "sales-order-vmc",
      amount: 40,
      paymentProcessor: "VMC",
      debitPhone: "0777816368",
    })

    expect(result?.trace).toBe("vmc-trace")
  })
})
