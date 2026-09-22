import { NextResponse } from "next/server"
import { getOrderFromDb } from "@/lib/order-data"
import { rateLimit } from "@/lib/rate-limit"
import { authorizeOrderAccess, orderAccessCredsFrom } from "@/lib/order-access"
import { log } from "@/lib/logger"

// Rate-limit to prevent data harvesting, and require proof of ownership —
// this payload carries buyer name/email/phone.
const orderDataLimiter = rateLimit({ windowMs: 60_000, max: 30 })

type Params = { id: string }

export async function GET(req: Request, ctx: { params: Promise<Params> }) {
  const rl = await orderDataLimiter.checkRequest(req)
  if (!rl.allowed) {
    return NextResponse.json({ error: "too_many_requests" }, { status: 429 })
  }

  const { id } = await ctx.params

  const access = await authorizeOrderAccess(id, orderAccessCredsFrom(req))
  if (!access.ok) {
    log.warn("order data — unauthorised read", { orderId: id, reason: access.reason })
    // Match the pre-existing not_found shape so we don't leak existence.
    return NextResponse.json({ error: "not_found" }, { status: access.reason === "not_found" ? 404 : 403 })
  }

  const order = await getOrderFromDb(id)
  if (!order) return NextResponse.json({ error: "not_found" }, { status: 404 })
  return NextResponse.json(order)
}
