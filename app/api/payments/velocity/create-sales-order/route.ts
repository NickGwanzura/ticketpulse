import { NextResponse } from "next/server"
import { createSalesOrder, getConfig } from "@/services/velocity"
import { validateSalesOrderPayload, isValidUUID } from "@/lib/velocity/validation"
import { acquireLock, releaseLock } from "@/lib/velocity/idempotency"
import { log } from "@/lib/logger"

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { currency, quantity, unitPrice, customerIdString, notes } = body

    if (!customerIdString || typeof customerIdString !== "string") {
      return NextResponse.json({ error: "customerIdString is required" }, { status: 400 })
    }

    if (!isValidUUID(customerIdString)) {
      return NextResponse.json({ error: "customerIdString must be a valid UUID, not an email or phone number" }, { status: 400 })
    }

    const totalAmount = quantity * unitPrice

    const validationError = validateSalesOrderPayload({ currency, quantity, unitPrice, totalAmount })
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 })
    }

    const lockKey = `sales-order:${customerIdString}:${Date.now()}`
    if (!await acquireLock(lockKey)) {
      return NextResponse.json({ error: "A sales order is already being created. Please wait." }, { status: 429 })
    }

    try {
      const config = getConfig()
      const currentDate = new Date().toISOString().split("T")[0]

      const payload = {
        currencyCodeString: currency,
        customerIdString,
        orderDate: currentDate,
        dueDate: currentDate,
        notes: notes ?? "TicketPulse Event Purchase",
        authorized: true,
        items: [
          {
            itemCode: config.itemCode,
            qty: quantity,
            unitPrice,
            amount: totalAmount,
          },
        ],
      }

      log.info("velocity create sales order", {
        customerIdString,
        amount: totalAmount,
        currency,
      })

      const result = await createSalesOrder(payload)

      return NextResponse.json({
        success: true,
        workflowId: result.workflowId,
        salesOrderTrace: result.body.trace,
        externalId: result.externalId,
        outstandingAmount: result.body.outstandingAmount,
        status: result.body.status,
      })
    } finally {
      await releaseLock(lockKey)
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create sales order"
    log.error("create-sales-order failed", { error: message })
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
