import { NextResponse } from "next/server"
import { z } from "zod"
import { eq, and, inArray, sql } from "drizzle-orm"
import { db } from "@/db"
import { events, orders, orderItems, ticketTiers, vendorListings, vendors, promoCodes, ticketQuestions } from "@/db/schema"
import { startOrderVerification } from "@/lib/order-verification"
import { PESEPAY_METHODS, getPesepay, pesepayUrls } from "@/lib/pesepay"
import {
  fetchVelocityCustomer,
  createVelocitySalesOrder,
  initiateVelocityTransaction,
  velocityUrls,
} from "@/lib/velocity"
import { checkoutLimiter } from "@/lib/rate-limit"

const TicketItem = z.object({
  kind: z.literal("ticket"),
  tierId: z.string().uuid(),
  quantity: z.number().int().positive().max(50),
})

const VendorAddonItem = z.object({
  kind: z.literal("vendor_addon"),
  listingId: z.string().uuid(),
  quantity: z.number().int().positive().max(10),
})

const Body = z.object({
  email: z.string().email().toLowerCase().trim(),
  name: z.string().min(1).max(120).trim(),
  phone: z.string().min(3).max(40).trim(),
  paymentMethod: z.enum(["ecocash", "card", "omari", "velocity-ecocash", "velocity-vmc"]),
  eventSlug: z.string().min(1).max(160),
  items: z
    .array(z.discriminatedUnion("kind", [TicketItem, VendorAddonItem]))
    .min(1)
    .max(30),
  promoCode: z.string().max(40).optional(),
  questionResponses: z.record(z.string().uuid(), z.string().min(0).max(2000)).optional(),
})

export async function POST(req: Request) {
  // Rate limit: 10 requests per minute per IP
  const rl = checkoutLimiter.checkRequest(req)
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many requests" }, {
      status: 429,
      headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) },
    })
  }

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

  // ── Event availability check ───────────────────────────────────────────
  if (event.status !== "published") {
    return NextResponse.json({ error: "This event is not currently available for purchase" }, { status: 400 })
  }

  // ── Resolve ticket tier prices server-side ──────────────────────────
  const ticketItems = parsed.items.filter((i): i is typeof i & { kind: "ticket" } => i.kind === "ticket")
  const vendorAddonItems = parsed.items.filter((i): i is typeof i & { kind: "vendor_addon" } => i.kind === "vendor_addon")

  const tiers = await db
    .select()
    .from(ticketTiers)
    .where(eq(ticketTiers.eventId, event.id))
  const tierById = new Map(tiers.map((t) => [t.id, t]))

  const now = new Date()

  for (const item of ticketItems) {
    const tier = tierById.get(item.tierId)
    if (!tier) {
      return NextResponse.json({ error: `Tier ${item.tierId} not in event` }, { status: 400 })
    }

    // Sales window check
    if (tier.salesStart && new Date(tier.salesStart) > now) {
      return NextResponse.json({ error: `"${tier.name}" is not yet available for purchase` }, { status: 400 })
    }
    if (tier.salesEnd && new Date(tier.salesEnd) < now) {
      return NextResponse.json({ error: `Sales for "${tier.name}" have ended` }, { status: 400 })
    }

    // Availability check
    if (Number(tier.soldQuantity ?? 0) >= Number(tier.totalQuantity ?? 0)) {
      return NextResponse.json({ error: `"${tier.name}" is sold out` }, { status: 400 })
    }
    if (Number(tier.totalQuantity ?? 0) - Number(tier.soldQuantity ?? 0) < item.quantity) {
      return NextResponse.json({ error: `Only ${Number(tier.totalQuantity ?? 0) - Number(tier.soldQuantity ?? 0)} ticket(s) left for "${tier.name}"` }, { status: 400 })
    }

    // Max per order check
    if (tier.maxPerOrder && item.quantity > tier.maxPerOrder) {
      return NextResponse.json({ error: `Maximum ${tier.maxPerOrder} ticket(s) per order for "${tier.name}"` }, { status: 400 })
    }
  }

  // ── Resolve vendor addon prices server-side ─────────────────────────
  let vendorAddonPrices: Map<string, { price: number; currency: string; packageName: string; vendorName: string }> = new Map()
  if (vendorAddonItems.length > 0) {
    const listingRows = await db
      .select({
        id: vendorListings.id,
        price: vendorListings.price,
        currency: vendorListings.currency,
        packageName: vendorListings.packageName,
        businessName: vendors.businessName,
      })
      .from(vendorListings)
      .leftJoin(vendors, eq(vendorListings.vendorId, vendors.id))
      .where(inArray(vendorListings.id, vendorAddonItems.map((i) => i.listingId)))

    for (const r of listingRows) {
      vendorAddonPrices.set(r.id, {
        price: Number(r.price),
        currency: r.currency ?? "USD",
        packageName: r.packageName,
        vendorName: r.businessName ?? "Vendor",
      })
    }

    for (const item of vendorAddonItems) {
      if (!vendorAddonPrices.has(item.listingId)) {
        return NextResponse.json({ error: `Vendor addon ${item.listingId} not found` }, { status: 400 })
      }
    }
  }

  // ── Compute total & currency ────────────────────────────────────────
  const allCurrencies = new Set<string>()
  for (const item of ticketItems) {
    const t = tierById.get(item.tierId)!
    allCurrencies.add(t.currency ?? "USD")
  }
  for (const item of vendorAddonItems) {
    const v = vendorAddonPrices.get(item.listingId)!
    allCurrencies.add(v.currency)
  }

  if (allCurrencies.size > 1) {
    return NextResponse.json({ error: "Mixed-currency cart not supported yet" }, { status: 400 })
  }
  const currency = [...allCurrencies][0] ?? "USD"

  let total = 0
  for (const item of ticketItems) {
    const t = tierById.get(item.tierId)!
    total += Number(t.price) * item.quantity
  }
  for (const item of vendorAddonItems) {
    const v = vendorAddonPrices.get(item.listingId)!
    total += v.price * item.quantity
  }

  // ── Apply promo code (if provided) ───────────────────────────────────
  let appliedPromo: { code: string; type: string; value: string; discount: number } | null = null
  if (parsed.promoCode) {
    const code = parsed.promoCode.toUpperCase()
    const [promo] = await db
      .select()
      .from(promoCodes)
      .where(and(eq(promoCodes.code, code), eq(promoCodes.eventId, event.id)))
      .limit(1)

    if (promo && promo.active) {
      const isExpired = promo.expiresAt && new Date(promo.expiresAt) < new Date()
      const isMaxed = (promo.maxUses ?? 0) > 0 && (promo.usedCount ?? 0) >= (promo.maxUses ?? 0)
      const meetsMin = !promo.minPurchaseAmount || Number(promo.minPurchaseAmount) <= 0 || total >= Number(promo.minPurchaseAmount)

      if (!isExpired && !isMaxed && meetsMin) {
        let discount = 0
        if (promo.type === "percent") {
          discount = Math.round(total * (Number(promo.value) / 100) * 100) / 100
        } else {
          discount = Math.min(Number(promo.value), total)
        }
        total = Math.max(0, Math.round((total - discount) * 100) / 100)
        appliedPromo = { code: promo.code, type: promo.type, value: promo.value.toString(), discount }

        // Increment used count
        await db
          .update(promoCodes)
          .set({ usedCount: sql<number>`${promoCodes.usedCount} + 1` })
          .where(eq(promoCodes.id, promo.id))
      }
    }
  }

  const isVelocity = parsed.paymentMethod.startsWith("velocity-")
  const method = isVelocity ? null : PESEPAY_METHODS[parsed.paymentMethod]
  if (!isVelocity && !method) {
    return NextResponse.json({ error: "Unsupported payment method" }, { status: 400 })
  }

  // Offline cash flows skip PesePay entirely and go straight to the verify
  // email step, just like before this integration existed. Online flows insert
  // as `pending` and only progress once the provider confirms the payment.
  const initialStatus = method && method.flow === "offline" ? "awaiting_verification" : "pending"

  // Validate question responses if provided
  let questionResponseMeta: Record<string, string> | undefined
  if (parsed.questionResponses && Object.keys(parsed.questionResponses).length > 0) {
    const eventQuestionsList = await db
      .select({ id: ticketQuestions.id, required: ticketQuestions.required })
      .from(ticketQuestions)
      .where(eq(ticketQuestions.eventId, event.id))

    const questionMap = new Map(eventQuestionsList.map((q) => [q.id, q]))
    for (const [qid, answer] of Object.entries(parsed.questionResponses)) {
      const q = questionMap.get(qid)
      if (!q) {
        return NextResponse.json({ error: `Invalid question ID: ${qid}` }, { status: 400 })
      }
      if (q.required && !answer.trim()) {
        return NextResponse.json({ error: `Required question missing answer` }, { status: 400 })
      }
    }
    questionResponseMeta = parsed.questionResponses
  }

  const orderMetadata: Record<string, unknown> = {}
  if (appliedPromo) orderMetadata.promo = appliedPromo
  if (questionResponseMeta) orderMetadata.questionResponses = questionResponseMeta

  const [order] = await db
    .insert(orders)
    .values({
      userId: null,
      eventId: event.id,
      status: initialStatus,
      totalAmount: total.toFixed(2),
      currency,
      paymentMethod: parsed.paymentMethod,
      metadata: Object.keys(orderMetadata).length > 0 ? orderMetadata : undefined,
      guestEmail: parsed.email,
      guestName: parsed.name,
      guestPhone: parsed.phone,
    })
    .returning({ id: orders.id })

  // ── Insert order items (tickets + vendor addons) ────────────────────
  const orderItemValues: {
    orderId: string
    tierId?: string
    type: string
    quantity: number
    unitPrice: string
    total: string
  }[] = []

  for (const item of ticketItems) {
    const t = tierById.get(item.tierId)!
    const unit = Number(t.price)
    orderItemValues.push({
      orderId: order.id,
      tierId: item.tierId,
      type: "ticket",
      quantity: item.quantity,
      unitPrice: unit.toFixed(2),
      total: (unit * item.quantity).toFixed(2),
    })
  }

  for (const item of vendorAddonItems) {
    const v = vendorAddonPrices.get(item.listingId)!
    orderItemValues.push({
      orderId: order.id,
      type: "vendor_addon",
      quantity: item.quantity,
      unitPrice: v.price.toFixed(2),
      total: (v.price * item.quantity).toFixed(2),
    })
  }

  await db.insert(orderItems).values(orderItemValues)

  const origin = new URL(req.url).origin

  // ─── Offline (pay at venue) ───────────────────────────────────────────────
  if (method && method.flow === "offline") {
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

  // ─── Velocity Africa flows ────────────────────────────────────────────────
  if (isVelocity) {
    try {
      const velocityCustomer = await fetchVelocityCustomer(parsed.phone)
      const customerId = velocityCustomer?.customerUid ?? null

      const salesOrder = await createVelocitySalesOrder({
        currency,
        customerId,
        amount: total,
        notes: `${event.title} · order ${order.id.slice(0, 8)}`,
      })

      const isEcoCash = parsed.paymentMethod === "velocity-ecocash"
      const { returnUrl } = velocityUrls(order.id, origin)
      const tx = await initiateVelocityTransaction({
        amount: total,
        processor: isEcoCash ? "ECOCASH" : "VMC",
        debitPhone: parsed.phone,
        debitCurrency: currency,
        authType: isEcoCash ? "REMOTE" : "WEB",
        salesOrderTrace: salesOrder.trace,
        returnUrl: isEcoCash ? undefined : returnUrl,
        customerEmail: isEcoCash ? undefined : parsed.email,
      })

      await db
        .update(orders)
        .set({
          paymentRef: tx.trace,
          metadata: {
            ...(appliedPromo ? { promo: appliedPromo } : {}),
            velocity: {
              salesOrderTrace: salesOrder.trace,
              transactionTrace: tx.trace,
              workflowId: salesOrder.workflowId,
            },
          },
          updatedAt: new Date(),
        })
        .where(eq(orders.id, order.id))

      if (tx.redirectUrl) {
        return NextResponse.json({
          orderId: order.id,
          flow: "redirect",
          redirectUrl: tx.redirectUrl,
        })
      }

      return NextResponse.json({
        orderId: order.id,
        flow: "seamless",
        reference: tx.trace,
        paid: false,
      })
    } catch (err) {
      await db
        .update(orders)
        .set({ status: "cancelled", updatedAt: new Date() })
        .where(eq(orders.id, order.id))
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Velocity payment failed" },
        { status: 502 },
      )
    }
  }

  // ─── PesePay flows ────────────────────────────────────────────────────────
  const pesepay = getPesepay()
  const { resultUrl, returnUrl } = pesepayUrls(order.id, origin)
  pesepay.resultUrl = resultUrl
  pesepay.returnUrl = returnUrl

  const reason = `${event.title} · order ${order.id.slice(0, 8)}`
  const merchantRef = order.id

  if (method && method.flow === "seamless" && method.code) {
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
