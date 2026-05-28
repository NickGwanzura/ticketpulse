import { NextResponse } from "next/server"
import { finalizeWorkflow } from "@/services/velocity"
import { acquireLock, releaseLock } from "@/lib/velocity/idempotency"
import { log } from "@/lib/logger"

type Params = { trace: string }

export async function POST(_req: Request, ctx: { params: Promise<Params> }) {
  const { trace } = await ctx.params

  if (!trace || typeof trace !== "string") {
    return NextResponse.json({ error: "Sales order trace is required" }, { status: 400 })
  }

  const lockKey = `finalize:${trace}`
  if (!acquireLock(lockKey)) {
    return NextResponse.json({ error: "Workflow finalization already in progress for this order" }, { status: 429 })
  }

  try {
    log.info("velocity finalize workflow", { salesOrderTrace: trace })

    const result = await finalizeWorkflow(trace)

    return NextResponse.json({
      success: true,
      salesOrderTrace: trace,
      workflowId: result.body.salesOrder.id,
      status: result.body.salesOrder.status,
      invoiceRef: result.body.invoice.id,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to finalize workflow"
    log.error("finalize-workflow failed", { salesOrderTrace: trace, error: message })
    return NextResponse.json({ error: message }, { status: 502 })
  } finally {
    releaseLock(lockKey)
  }
}
