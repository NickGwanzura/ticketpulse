import { NextResponse } from "next/server"
import { eq } from "drizzle-orm"
import { db } from "@/db"
import { orders } from "@/db/schema"
import { getPesepay } from "@/lib/pesepay"
import { startOrderVerification } from "@/lib/order-verification"

// PesePay calls this URL server-to-server once it has a definitive result for
// a transaction. The format varies (sometimes a JSON body with a payload,
// sometimes just the referenceNumber on the query string), so we accept both,
// then independently verify the status via the SDK before doing anything.
export async function POST(req: Request) {
  const url = new URL(req.url)
  let reference = url.searchParams.get("referenceNumber") ?? undefined

  if (!reference) {
    try {
      const body = await req.json().catch(() => null)
      reference = body?.referenceNumber ?? body?.reference ?? undefined
    } catch {
      // ignore parse failures — we'll bail below
    }
  }

  if (!reference) {
    return NextResponse.json({ error: "missing_reference" }, { status: 400 })
  }

  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.paymentRef, reference))
    .limit(1)

  if (!order) {
    return NextResponse.json({ error: "order_not_found" }, { status: 404 })
  }

  // Already moved past pending — webhook is a duplicate or arrived after the
  // client poll already advanced the order. Acknowledge to stop retries.
  if (order.status !== "pending") {
    return NextResponse.json({ ok: true, status: order.status })
  }

  const pesepay = getPesepay()
  const result = await pesepay.checkPayment(reference)
  if (!result.success) {
    return NextResponse.json({ ok: false, message: result.message }, { status: 200 })
  }
  if (!result.paid) {
    return NextResponse.json({ ok: true, status: "pending" })
  }

  if (!order.guestEmail) {
    return NextResponse.json({ error: "order_missing_email" }, { status: 500 })
  }
  const origin = process.env.PESEPAY_PUBLIC_URL?.replace(/\/$/, "") || url.origin
  await startOrderVerification({
    orderId: order.id,
    email: order.guestEmail,
    origin,
  })

  return NextResponse.json({ ok: true, status: "awaiting_verification" })
}
