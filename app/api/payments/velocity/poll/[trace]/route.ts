import { NextResponse } from "next/server"
import { pollTransaction } from "@/services/velocity"
import { log } from "@/lib/logger"

type Params = { trace: string }

export async function GET(_req: Request, ctx: { params: Promise<Params> }) {
  const { trace } = await ctx.params

  if (!trace || typeof trace !== "string") {
    return NextResponse.json({ error: "Transaction trace is required" }, { status: 400 })
  }

  try {
    const result = await pollTransaction(trace)

    log.info("velocity poll transaction", {
      transactionTrace: trace,
      pollStatus: result.body.pollStatus,
      status: result.body.paymentStatus,
    })

    return NextResponse.json({
      success: true,
      transactionTrace: result.body.trace,
      pollStatus: result.body.pollStatus,
      status: result.body.paymentStatus,
      amount: result.body.amount,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to poll transaction"
    log.error("poll transaction failed", { transactionTrace: trace, error: message })
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
