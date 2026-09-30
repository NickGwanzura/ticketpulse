import { NextResponse } from "next/server"
import { getOrderFromDb } from "@/lib/order-data"
import { rateLimit } from "@/lib/rate-limit"
import { authorizeOrderAccess, orderAccessCredsFrom } from "@/lib/order-access"
import { log } from "@/lib/logger"
import { requestIdFor, withRequestId } from "@/lib/request-id"

// Rate-limit to prevent data harvesting, and require proof of ownership —
// this payload carries buyer name/email/phone.
const orderDataLimiter = rateLimit({ windowMs: 60_000, max: 30 })

type Params = { id: string }

export async function GET(req: Request, ctx: { params: Promise<Params> }) {
  const { id } = await ctx.params
  const requestId = requestIdFor(req)
  const respond = (body: unknown, init?: ResponseInit) =>
    withRequestId(NextResponse.json(body, init), requestId)

  try {
    const rl = await orderDataLimiter.checkRequest(req)
    if (!rl.allowed) {
      return respond({ error: "too_many_requests", requestId }, { status: 429 })
    }

    const access = await authorizeOrderAccess(id, orderAccessCredsFrom(req))
    if (!access.ok) {
      log.warn("order data — unauthorised read", { orderId: id, reason: access.reason, requestId })
      // Match the pre-existing not_found shape so we don't leak existence.
      return respond({ error: "not_found", requestId }, { status: access.reason === "not_found" ? 404 : 403 })
    }

    const order = await getOrderFromDb(id)
    if (!order) return respond({ error: "not_found", requestId }, { status: 404 })
    return respond(order)
  } catch (error) {
    log.error("order data request failed", {
      orderId: id,
      requestId,
      errorType: error instanceof Error ? error.name : "UnknownError",
    })
    return respond({ error: "temporarily_unavailable", requestId }, { status: 503 })
  }
}
