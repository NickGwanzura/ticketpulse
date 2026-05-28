import { NextResponse } from "next/server"
import { pollTransaction, normalizeVelocityPollResponse } from "@/services/velocity"
import { log } from "@/lib/logger"

type Params = { trace: string }

export async function GET(_req: Request, ctx: { params: Promise<Params> }) {
  const { trace } = await ctx.params

  if (!trace || typeof trace !== "string") {
    return NextResponse.json({ error: "Transaction trace is required" }, { status: 400 })
  }

  const result = await pollTransaction(trace)
  const normalized = normalizeVelocityPollResponse(result)

  log.info("velocity poll transaction - raw response", {
    transactionTrace: trace,
    httpStatus: result.state === "network_error" ? 0 : undefined,
    velocityState: result.state,
    velocityStatus: result.status,
    paymentStatus: result.body?.paymentStatus,
    pollStatus: result.body?.pollStatus,
    amount: result.body?.amount,
    fullBody: JSON.stringify(result).slice(0, 5000),
  })

  log.info("velocity poll transaction - normalized", {
    transactionTrace: trace,
    localStatus: normalized.localStatus,
    velocityPollStatus: normalized.velocityPollStatus,
    velocityPaymentStatus: normalized.velocityPaymentStatus,
  })

  if (result.state === "network_error") {
    return NextResponse.json(
      {
        error: "Network error communicating with Velocity Africa",
        transactionTrace: trace,
        localStatus: "UNKNOWN",
        pollStatus: result.body?.pollStatus ?? "UNKNOWN",
        status: result.body?.paymentStatus ?? null,
      },
      { status: 502 },
    )
  }

  return NextResponse.json({
    success: true,
    transactionTrace: result.body?.trace ?? trace,
    pollStatus: result.body?.pollStatus,
    status: result.body?.paymentStatus,
    amount: result.body?.amount,
    localStatus: normalized.localStatus,
  })
}
