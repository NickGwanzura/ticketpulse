import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { initiateTransaction, getAuthType, getConfig } from "@/services/velocity"
import { validateTransactionPayload } from "@/lib/velocity/validation"
import { acquireLock, releaseLock } from "@/lib/velocity/idempotency"
import { log } from "@/lib/logger"

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }
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
    if (!await acquireLock(lockKey)) {
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
        debitRef: salesOrderTrace,
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
      const transactionTrace = result.body?.trace ?? result.externalId ?? null

      if (!transactionTrace) {
        log.error("velocity initiate transaction missing trace", {
          salesOrderTrace,
          responseBody: JSON.stringify(result).slice(0, 2000),
        })
        return NextResponse.json({
          error: "Velocity did not return a transaction reference. Please try again.",
        }, { status: 502 })
      }

      return NextResponse.json({
        success: true,
        transactionTrace,
        pollStatus: result.body?.pollStatus ?? "PENDING",
        status: result.body?.paymentStatus ?? null,
        amount: result.body?.amount ?? amount,
      })
    } finally {
      await releaseLock(lockKey)
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to initiate transaction"
    log.error("initiate-transaction failed", { error: message })
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
