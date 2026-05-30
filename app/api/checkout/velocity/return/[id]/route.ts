import { NextResponse } from "next/server"
import { eq } from "drizzle-orm"
import { db } from "@/db"
import { orders } from "@/db/schema"
import { isValidUUID } from "@/lib/velocity/validation"
import { log } from "@/lib/logger"

type Params = { id: string }

// Buyer lands here in the browser after completing Velocity's hosted checkout (card payments).
// This is a frontend UX page only — NOT proof of payment.
// We redirect to the orders page where client-side polling (via /api/checkout/velocity/status/[id])
// handles polling, finalization, and ticket issuance.
export async function GET(req: Request, ctx: { params: Promise<Params> }) {
  const { id } = await ctx.params
  const origin = new URL(req.url).origin

  if (!isValidUUID(id)) {
    return NextResponse.redirect(`${origin}/checkout?error=not_found`)
  }

  const [order] = await db.select().from(orders).where(eq(orders.id, id)).limit(1)
  if (!order) {
    return NextResponse.redirect(`${origin}/checkout?error=not_found`)
  }

  // Already paid — send to order page.
  const paidStatuses = new Set(["paid", "awaiting_verification"])
  if (paidStatuses.has(order.status ?? "")) {
    return NextResponse.redirect(`${origin}/orders/${id}?awaiting=1`)
  }

  if (order.status !== "pending") {
    return NextResponse.redirect(`${origin}/orders/${id}?error=cancelled`)
  }

  log.info("velocity return - user returned from hosted checkout", {
    orderId: id,
  })

  // Redirect to the orders page — client-side polling will pick up
  // the transaction status and finalize the workflow when ready.
  return NextResponse.redirect(`${origin}/orders/${id}?awaiting=1`)
}
