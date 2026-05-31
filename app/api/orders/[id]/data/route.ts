import { NextResponse } from "next/server"
import { getOrderFromDb } from "@/lib/order-data"
import { rateLimit } from "@/lib/rate-limit"

// Order UUIDs are unguessable, but rate-limit to prevent data harvesting
const orderDataLimiter = rateLimit({ windowMs: 60_000, max: 30 })

type Params = { id: string }

export async function GET(req: Request, ctx: { params: Promise<Params> }) {
  const rl = orderDataLimiter.checkRequest(req)
  if (!rl.allowed) {
    return NextResponse.json({ error: "too_many_requests" }, { status: 429 })
  }

  const { id } = await ctx.params
  const order = await getOrderFromDb(id)
  if (!order) return NextResponse.json({ error: "not_found" }, { status: 404 })
  return NextResponse.json(order)
}
