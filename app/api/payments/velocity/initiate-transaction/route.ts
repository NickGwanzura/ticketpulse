import { NextResponse } from "next/server"
import { initiateTransaction, getAuthType, getConfig } from "@/services/velocity"
import { validateTransactionPayload } from "@/lib/velocity/validation"
import { acquireLock, releaseLock } from "@/lib/velocity/idempotency"
import { log } from "@/lib/logger"

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const {
      amount,
      paymentProcessor,
      debitPhone,
      currency,
      salesOrderTrace,
    } = body

    if (!salesOrderTrace || typeof salesOrderTrace !== "string") {
      return NextResponse.json({ error: "salesOrderTrace is required" }, { status: 400 })
    }

    const validationError = validateTransactionPayload({
      amount,
      processor: paymentProcessor,
      phone: debitPhone,
      currency,
    })
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 })
    }

    const lockKey = `transaction:${salesOrderTrace}`
    if (!acquireLock(lockKey)) {
      return NextResponse.json({ error: "A transaction is already being processed for this order" }, { status: 429 })
    }

    try {
      const config = getConfig()
      const authType = getAuthType(paymentProcessor)
      const merchantPhone = config.merchantPhone

      if (!merchantPhone) {
        return NextResponse.json({ error: "Merchant phone not configured" }, { status: 500 })
      }

      const payload = {
        amount,
        paymentProcessorLabel: paymentProcessor,
        debitPhone,
        debitRegion: "ZW",
        debitCurrency: currency,
        debitRef: "ticketpulse",
        creditPhone: merchantPhone,
        creditRegion: "ZW",
        creditAccount: merchantPhone,
        type: "REQUEST",
        authType,
        salesOrderId: salesOrderTrace,
      }

      log.info("velocity initiate transaction", {
        amount,
        processor: paymentProcessor,
        authType,
        salesOrderTrace,
      })

      const result = await initiateTransaction(payload)

      return NextResponse.json({
        success: true,
        transactionTrace: result.body.trace,
        pollStatus: result.body.pollStatus,
        status: result.body.paymentStatus,
        amount: result.body.amount,
      })
    } finally {
      releaseLock(lockKey)
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to initiate transaction"
    log.error("initiate-transaction failed", { error: message })
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
