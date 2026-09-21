import { NextResponse } from "next/server"
import { eq } from "drizzle-orm"
import { db } from "@/db"
import { orders } from "@/db/schema"
import { isValidUUID } from "@/lib/velocity/validation"
import { log } from "@/lib/logger"
import { getBaseUrl, getOrderUrl } from "@/lib/url-config"

type Params = { id: string }

// Buyer lands here in the browser after completing Velocity's hosted checkout (card payments).
// This is a frontend UX page only — NOT proof of payment.
// We redirect to the orders page where client-side polling (via /api/checkout/velocity/status/[id])
// handles polling, finalization, and ticket issuance.
export async function GET(req: Request, ctx: { params: Promise<Params> }) {
  const { id } = await ctx.params
  const origin = getBaseUrl()

  if (!isValidUUID(id)) {
    return NextResponse.redirect(`${origin}/checkout?error=not_found`)
  }

  const [order] = await db.select().from(orders).where(eq(orders.id, id)).limit(1)
  if (!order) {
    return NextResponse.redirect(`${origin}/checkout?error=not_found`)
  }

  // Already paid — send straight to order page.
  if (order.status === "paid") {
    return NextResponse.redirect(`${getOrderUrl(id)}&welcome=1`)
  }

  if (order.status !== "pending") {
    return NextResponse.redirect(`${getOrderUrl(id)}&error=cancelled`)
  }

  log.info("velocity return - user returned from hosted checkout", {
    orderId: id,
  })

  // Still pending — redirect to the orders page where client-side polling
  // picks up the transaction status and finalizes the workflow when ready.
  return NextResponse.redirect(`${getOrderUrl(id)}&welcome=1`)
}
