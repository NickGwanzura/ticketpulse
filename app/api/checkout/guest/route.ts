import { NextResponse } from "next/server"
import { z } from "zod"
import { eq } from "drizzle-orm"
import { db } from "@/db"
import { events, orders, orderItems, ticketTiers } from "@/db/schema"
import { startOrderVerification } from "@/lib/order-verification"
import { PESEPAY_METHODS, getPesepay, pesepayUrls } from "@/lib/pesepay"

const Body = z.object({
  email: z.string().email().toLowerCase().trim(),
  name: z.string().min(1).max(120).trim(),
  phone: z.string().min(3).max(40).trim(),
  paymentMethod: z.enum(["ecocash", "card", "paynow", "usd", "omari"]),
  eventSlug: z.string().min(1).max(160),
  items: z
    .array(
      z.object({
        tierId: z.string().uuid(),
        quantity: z.number().int().positive().max(50),
      }),
    )
    .min(1)
    .max(20),
})

export async function POST(req: Request) {
  let parsed: z.infer<typeof Body>
  try {
    parsed = Body.parse(await req.json())
  } catch (err) {
    return NextResponse.json(
      { error: "Invalid request", detail: err instanceof Error ? err.message : null },
      { status: 400 },
    )
  }

  const [event] = await db.select().from(events).where(eq(events.slug, parsed.eventSlug)).limit(1)
  if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 })

  // Pull tier prices server-side so the client can't dictate amounts.
  const tiers = await db
    .select()
    .from(ticketTiers)
    .where(eq(ticketTiers.eventId, event.id))

  const byId = new Map(tiers.map((t) => [t.id, t]))
  for (const item of parsed.items) {
    if (!byId.has(item.tierId)) {
      return NextResponse.json({ error: "Tier not in event" }, { status: 400 })
    }
  }

  // Compute total. Mixed currencies aren't supported in v1 — bail early.
  const currencies = new Set(parsed.items.map((i) => byId.get(i.tierId)!.currency ?? "USD"))
  if (currencies.size > 1) {
    return NextResponse.json({ error: "Mixed-currency cart not supported yet" }, { status: 400 })
  }
  const currency = [...currencies][0] ?? "USD"
  const total = parsed.items.reduce((sum, i) => {
    const t = byId.get(i.tierId)!
    return sum + Number(t.price) * i.quantity
  }, 0)

  const method = PESEPAY_METHODS[parsed.paymentMethod]
  if (!method) {
    return NextResponse.json({ error: "Unsupported payment method" }, { status: 400 })
  }

  // Offline cash flows skip PesePay entirely and go straight to the verify
  // email step, just like before this integration existed. Online flows insert
  // as `pending` and only progress once PesePay confirms the payment.
  const initialStatus = method.flow === "offline" ? "awaiting_verification" : "pending"

  const [order] = await db
    .insert(orders)
    .values({
      userId: null,
      eventId: event.id,
      status: initialStatus,
      totalAmount: total.toFixed(2),
      currency,
      paymentMethod: parsed.paymentMethod,
      guestEmail: parsed.email,
      guestName: parsed.name,
      guestPhone: parsed.phone,
    })
    .returning({ id: orders.id })

  await db.insert(orderItems).values(
    parsed.items.map((i) => {
      const t = byId.get(i.tierId)!
      const unit = Number(t.price)
      return {
        orderId: order.id,
        tierId: i.tierId,
        type: "ticket",
        quantity: i.quantity,
        unitPrice: unit.toFixed(2),
        total: (unit * i.quantity).toFixed(2),
      }
    }),
  )

  const origin = new URL(req.url).origin

  // ─── Offline (pay at venue) ───────────────────────────────────────────────
  if (method.flow === "offline") {
    const { expiresAt } = await startOrderVerification({
      orderId: order.id,
      email: parsed.email,
      origin,
    })
    return NextResponse.json({
      orderId: order.id,
      flow: "offline",
      status: "awaiting_verification",
      sentTo: parsed.email,
      expiresAt: expiresAt.toISOString(),
    })
  }

  // ─── PesePay flows ────────────────────────────────────────────────────────
  const pesepay = getPesepay()
  const { resultUrl, returnUrl } = pesepayUrls(order.id, origin)
  pesepay.resultUrl = resultUrl
  pesepay.returnUrl = returnUrl

  const reason = `${event.title} · order ${order.id.slice(0, 8)}`
  const merchantRef = order.id

  if (method.flow === "seamless" && method.code) {
    const payment = pesepay.createPayment(
      currency,
      method.code,
      parsed.email,
      parsed.phone,
      parsed.name,
    )
    const requiredFields = method.phoneField ? { [method.phoneField]: parsed.phone } : undefined

    const res = await pesepay.makeSeamlessPayment(payment, reason, total, requiredFields)
    if (!res.success) {
      await db
        .update(orders)
        .set({ status: "cancelled", updatedAt: new Date() })
        .where(eq(orders.id, order.id))
      return NextResponse.json(
        { error: res.message ?? "Payment provider rejected the request" },
        { status: 502 },
      )
    }

    await db
      .update(orders)
      .set({
        paymentRef: res.referenceNumber,
        metadata: { pesepay: { pollUrl: res.pollUrl, reference: res.referenceNumber } },
        updatedAt: new Date(),
      })
      .where(eq(orders.id, order.id))

    // Some methods (e.g. Innbucks QR) might never resolve in this call; the
    // client will poll /api/checkout/pesepay/status to drive the UX.
    return NextResponse.json({
      orderId: order.id,
      flow: "seamless",
      reference: res.referenceNumber,
      paid: res.paid === true,
    })
  }

  // Redirect flow (card / paynow). PesePay's hosted page collects the card
  // details so we stay out of PCI scope.
  const transaction = pesepay.createTransaction(total, currency, reason, merchantRef)
  const res = await pesepay.initiateTransaction(transaction)
  if (!res.success || !res.redirectUrl) {
    await db
      .update(orders)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(eq(orders.id, order.id))
    return NextResponse.json(
      { error: res.message ?? "Could not start hosted checkout" },
      { status: 502 },
    )
  }

  await db
    .update(orders)
    .set({
      paymentRef: res.referenceNumber,
      metadata: { pesepay: { pollUrl: res.pollUrl, reference: res.referenceNumber } },
      updatedAt: new Date(),
    })
    .where(eq(orders.id, order.id))

  return NextResponse.json({
    orderId: order.id,
    flow: "redirect",
    redirectUrl: res.redirectUrl,
  })
}
