import { NextResponse } from "next/server"
import { z } from "zod"
import { eq, and, inArray, desc, sql } from "drizzle-orm"
import { db } from "@/db"
import { events, orders, orderItems, ticketTiers, vendorListings, vendors, promoCodes, ticketQuestions } from "@/db/schema"
import { checkoutLimiter } from "@/lib/rate-limit"
import { getConfig, initiateTransaction, createSalesOrder, getAuthType, getDefaultCustomerId } from "@/services/velocity"
import { validateTransactionPayload, formatPhone } from "@/lib/velocity/validation"
import { withLock } from "@/lib/velocity/idempotency"
import { deliverTicketForPaidOrder } from "@/lib/delivery"
import { log } from "@/lib/logger"
import { trackEvent } from "@/lib/analytics"
import type { VelocityOrderMetadata, VelocityPollStatus } from "@/types/velocity"

// Flexible redirect URL extraction: recursively checks the entire Velocity response
// for any field name that could contain a hosted checkout URL.
// Velocity may return the URL under different field names across API versions.
function extractRedirectUrl(body: Record<string, unknown>): string | undefined {
  const candidates = [
    "redirectUrl", "redirect_url", "paymentUrl", "payment_url",
    "checkoutUrl", "checkout_url", "gatewayUrl", "gateway_url",
    "authorizationUrl", "authorization_url",
    "hostedUrl", "hosted_url", "paymentLink", "payment_link",
    "checkoutLink", "checkout_link", "embeddedUrl", "embedded_url",
  ]

  for (const key of candidates) {
    const val = body[key]
    // Only accept HTTPS redirect URLs for payment security
    if (typeof val === "string" && val.startsWith("https://")) {
      return val
    }
  }

  for (const key of Object.keys(body)) {
    const val = body[key]
    if (typeof val === "object" && val !== null && !Array.isArray(val)) {
      const nested = extractRedirectUrl(val as Record<string, unknown>)
      if (nested) return nested
    }
  }

  return undefined
}

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
  paymentMethod: z.enum(["velocity-ecocash", "velocity-card"]),
  eventSlug: z.string().min(1).max(160),
  items: z
    .array(z.discriminatedUnion("kind", [TicketItem, VendorAddonItem]))
    .min(1)
    .max(30),
  promoCode: z.string().max(40).optional(),
  questionResponses: z.record(z.string().uuid(), z.string().min(0).max(2000)).optional(),
})

export async function POST(req: Request) {
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

  if (event.status !== "published") {
    return NextResponse.json({ error: "This event is not currently available for purchase" }, { status: 400 })
  }

  const ticketItems = parsed.items.filter((i): i is typeof i & { kind: "ticket" } => i.kind === "ticket")
  const vendorAddonItems = parsed.items.filter((i): i is typeof i & { kind: "vendor_addon" } => i.kind === "vendor_addon")

  // Velocity sales orders need at least one ticket item to compute a valid unit price.
  if (ticketItems.length === 0) {
    return NextResponse.json({ error: "At least one ticket is required" }, { status: 400 })
  }

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
    if (tier.salesStart && new Date(tier.salesStart) > now) {
      return NextResponse.json({ error: `"${tier.name}" is not yet available for purchase` }, { status: 400 })
    }
    if (tier.salesEnd && new Date(tier.salesEnd) < now) {
      return NextResponse.json({ error: `Sales for "${tier.name}" have ended` }, { status: 400 })
    }
    if (Number(tier.soldQuantity ?? 0) >= Number(tier.totalQuantity ?? 0)) {
      return NextResponse.json({ error: `"${tier.name}" is sold out` }, { status: 400 })
    }
    if (Number(tier.totalQuantity ?? 0) - Number(tier.soldQuantity ?? 0) < item.quantity) {
      return NextResponse.json({ error: `Only ${Number(tier.totalQuantity ?? 0) - Number(tier.soldQuantity ?? 0)} ticket(s) left for "${tier.name}"` }, { status: 400 })
    }
    if (tier.maxPerOrder && item.quantity > tier.maxPerOrder) {
      return NextResponse.json({ error: `Maximum ${tier.maxPerOrder} ticket(s) per order for "${tier.name}"` }, { status: 400 })
    }
  }

  const vendorAddonPrices: Map<string, { price: number; currency: string; packageName: string; vendorName: string }> = new Map()
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

  let appliedPromo: { code: string; type: string; value: string; discount: number; id: string } | null = null
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
        appliedPromo = { code: promo.code, type: promo.type, value: promo.value.toString(), discount, id: promo.id }
      }
    }
  }

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

  const baseMeta = {
    ...(appliedPromo ? { promo: appliedPromo } : {}),
    ...(questionResponseMeta ? { questionResponses: questionResponseMeta } : {}),
  }

  // ── Idempotency: resume an existing in-progress order if one exists ──────────
  // Handles retries, double-clicks, and page-refresh re-submissions without
  // creating duplicate orders or surfacing a confusing error to the user.
  async function findResumableOrder() {
    const [existing] = await db
      .select({
        id: orders.id,
        paymentMethod: orders.paymentMethod,
        totalAmount: orders.totalAmount,
        currency: orders.currency,
        metadata: orders.metadata,
      })
      .from(orders)
      .where(
        and(
          eq(orders.eventId, event.id),
          eq(orders.guestEmail, parsed.email),
          inArray(orders.status, ["pending", "awaiting_verification"]),
          sql`${orders.createdAt} > now() - interval '30 minutes'`,
          sql`${orders.metadata}->'velocity'->>'transactionTrace' IS NOT NULL`,
        ),
      )
      .orderBy(desc(orders.createdAt))
      .limit(1)
    return existing ?? null
  }

  const resumable = await findResumableOrder()
  if (resumable) {
    const meta = (resumable.metadata ?? {}) as { velocity?: VelocityOrderMetadata }
    const vm = meta.velocity!
    const isCard = resumable.paymentMethod === "velocity-card"
    log.info("velocity checkout - resuming existing order", { orderId: resumable.id, email: parsed.email })
    return NextResponse.json({
      success: true,
      paymentMethod: isCard ? "CARD" : "ECOCASH",
      orderId: resumable.id,
      salesOrderTrace: vm.salesOrderTrace,
      transactionTrace: vm.transactionTrace,
      flow: isCard ? "velocity-redirect" : "velocity-seamless",
      pollRequired: isCard ? undefined : true,
      redirectUrl: null,
      amount: Number(resumable.totalAmount),
      currency: resumable.currency ?? currency,
      resumed: true,
    })
  }

  // ── Phase 1: Create order atomically under lock ────────────────────────────
  // withLock uses pg_try_advisory_xact_lock (transaction-scoped) — the lock
  // auto-releases on commit. DB writes are atomic; HTTP calls happen after.
  const lockKey = `velocity-checkout:${parsed.email}:${event.id}`

  const creation = await withLock(lockKey, async (tx) => {
    const [order] = await tx
      .insert(orders)
      .values({
        userId: null,
        eventId: event.id,
        status: "pending",
        totalAmount: total.toFixed(2),
        currency,
        paymentMethod: parsed.paymentMethod,
        guestEmail: parsed.email,
        guestName: parsed.name,
        guestPhone: parsed.phone,
        metadata: baseMeta,
      })
      .returning({ id: orders.id })

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

    await tx.insert(orderItems).values(orderItemValues)
    return { orderId: order.id }
  })

  if (!creation) {
    // Lock contention: a concurrent request is creating an order at this exact
    // moment. Wait briefly for it to commit, then try to resume that order.
    await new Promise((r) => setTimeout(r, 400))
    const concurrent = await findResumableOrder()
    if (concurrent) {
      const meta = (concurrent.metadata ?? {}) as { velocity?: VelocityOrderMetadata }
      const vm = meta.velocity!
      const isCard = concurrent.paymentMethod === "velocity-card"
      log.info("velocity checkout - resuming concurrent order after lock wait", { orderId: concurrent.id })
      return NextResponse.json({
        success: true,
        paymentMethod: isCard ? "CARD" : "ECOCASH",
        orderId: concurrent.id,
        salesOrderTrace: vm.salesOrderTrace,
        transactionTrace: vm.transactionTrace,
        flow: isCard ? "velocity-redirect" : "velocity-seamless",
        pollRequired: isCard ? undefined : true,
        redirectUrl: null,
        amount: Number(concurrent.totalAmount),
        currency: concurrent.currency ?? currency,
        resumed: true,
      })
    }
    return NextResponse.json(
      { error: "Your checkout is being processed. Please wait a moment and try again." },
      { status: 429 },
    )
  }

  const { orderId } = creation

  const sessionId = req.headers.get("x-session-id") ?? crypto.randomUUID()
  const referrer = req.headers.get("referer")
  const userAgent = req.headers.get("user-agent")

  trackEvent({ event: "CHECKOUT_STARTED", eventId: event.id, orderId, sessionId, buyerEmail: parsed.email, paymentMethod: parsed.paymentMethod, referrer, userAgent, amount: total })
  trackEvent({ event: "BUYER_DETAILS_SUBMITTED", eventId: event.id, orderId, sessionId, buyerEmail: parsed.email, referrer, userAgent })
  trackEvent({ event: "PAYMENT_METHOD_SELECTED", eventId: event.id, orderId, sessionId, buyerEmail: parsed.email, paymentMethod: parsed.paymentMethod, referrer, userAgent })

  // ── Zero-amount order (100% promo) — skip Velocity, mark paid directly ────
  if (total <= 0) {
    await db
      .update(orders)
      .set({ status: "paid", paidAt: new Date(), updatedAt: new Date() })
      .where(eq(orders.id, orderId))

    deliverTicketForPaidOrder(orderId).catch((err) =>
      log.error("velocity checkout - free order delivery failed", { orderId, error: String(err) }),
    )

    trackEvent({ event: "PAYMENT_CONFIRMED", eventId: event.id, orderId, paymentMethod: parsed.paymentMethod, amount: 0 })

    return NextResponse.json({
      success: true,
      paymentMethod: "FREE",
      orderId,
      flow: "free",
      amount: 0,
      currency,
    })
  }

  // ── Phase 2: Velocity API calls (lock already released) ───────────────────
  try {
    const config = getConfig()
    const currentDate = new Date().toISOString().split("T")[0]

    const velocityCustomerId = await getDefaultCustomerId()
    log.info("velocity checkout - using default customer UUID", { customerId: velocityCustomerId })

    const ticketQty = ticketItems.reduce((s, i) => s + i.quantity, 0)
    const salesOrderPayload = {
      currencyCodeString: currency as "USD" | "ZWG",
      customerIdString: velocityCustomerId,
      orderDate: currentDate,
      dueDate: currentDate,
      notes: "TicketPulse Event Purchase",
      authorized: true,
      items: [
        {
          itemCode: config.itemCode,
          qty: ticketQty,
          unitPrice: total / ticketQty,
          amount: total,
        },
      ],
    }

    log.info("velocity checkout - creating sales order", { orderId, payload: salesOrderPayload })
    const salesOrder = await createSalesOrder(salesOrderPayload)
    const salesOrderTrace = salesOrder.body.trace
    const salesOrderId = salesOrder.body.id ?? salesOrderTrace

    log.info("velocity checkout - sales order created", {
      orderId,
      trace: salesOrderTrace,
      id: salesOrder.body.id,
      workflowId: salesOrder.workflowId,
      status: salesOrder.body.status,
      usingSalesOrderId: salesOrderId,
    })

    const formattedPhone = formatPhone(parsed.phone)
    const processor: "ECOCASH" | "VMC" = parsed.paymentMethod === "velocity-ecocash" ? "ECOCASH" : "VMC"
    const authType = getAuthType(processor)

    const validationError = validateTransactionPayload({
      amount: total,
      processor,
      phone: formattedPhone,
      currency,
    })
    if (validationError) {
      await db
        .update(orders)
        .set({ status: "cancelled", updatedAt: new Date() })
        .where(eq(orders.id, orderId))
      return NextResponse.json({ error: validationError }, { status: 400 })
    }

    if (!config.merchantPhone) {
      await db
        .update(orders)
        .set({ status: "cancelled", updatedAt: new Date() })
        .where(eq(orders.id, orderId))
      return NextResponse.json({ error: "Merchant phone not configured" }, { status: 500 })
    }

    const origin = new URL(req.url).origin
    const isCard = processor === "VMC"

    const returnUrlFields: Record<string, string | undefined> = {}
    if (isCard) {
      const base = `${origin}/api/checkout/velocity`
      returnUrlFields.returnUrl = `${base}/return/${orderId}`
      returnUrlFields.successUrl = `${base}/return/${orderId}`
      returnUrlFields.cancelUrl = `${origin}/orders/${orderId}?error=cancelled`
    }

    const transactionPayload = {
      amount: total,
      paymentProcessorLabel: processor,
      debitPhone: formattedPhone,
      debitRegion: "ZW",
      debitCurrency: currency as "USD" | "ZWG",
      debitRef: "ticketpulse",
      creditPhone: config.merchantPhone,
      creditRegion: "ZW",
      creditAccount: config.merchantPhone,
      type: "REQUEST",
      authType,
      salesOrderId,
      ...returnUrlFields,
    }

    log.info("velocity checkout - initiating transaction", { orderId, salesOrderId, processor, amount: total, authType })
    const transaction = await initiateTransaction(transactionPayload)

    const redirectUrl = extractRedirectUrl(transaction as unknown as Record<string, unknown>)

    log.info("velocity checkout - transaction response", {
      orderId,
      processor,
      authType,
      trace: transaction.body.trace,
      pollStatus: transaction.body.pollStatus,
      paymentStatus: transaction.body.paymentStatus,
      redirectUrlFound: !!redirectUrl,
      allBodyKeys: Object.keys(transaction.body).join(", "),
      allResponseKeys: Object.keys(transaction).join(", "),
    })

    const pollStatus = (transaction.body.pollStatus ?? "PENDING") as VelocityPollStatus

    const velocityMeta: VelocityOrderMetadata = {
      salesOrderTrace,
      transactionTrace: transaction.body.trace,
      outstandingAmount: total,
      paymentProcessor: processor,
      pollStatus,
      paymentRef: null,
      invoiceRef: null,
      initiatedAt: new Date().toISOString(),
      finalizedAt: null,
    }

    await db
      .update(orders)
      .set({
        metadata: { ...baseMeta, velocity: velocityMeta },
        updatedAt: new Date(),
      })
      .where(eq(orders.id, orderId))

    trackEvent({ event: "PAYMENT_INITIATED", eventId: event.id, orderId, sessionId, buyerEmail: parsed.email, paymentMethod: parsed.paymentMethod, amount: total })

    if (isCard && !redirectUrl) {
      await db
        .update(orders)
        .set({
          metadata: { ...baseMeta, velocity: { ...velocityMeta, pollStatus: "INITIATED_BUT_NO_REDIRECT" as VelocityPollStatus } },
          updatedAt: new Date(),
        })
        .where(eq(orders.id, orderId))

      log.error("velocity checkout - card payment missing redirect URL", {
        orderId,
        responseBody: JSON.stringify(transaction).slice(0, 2000),
      })
      return NextResponse.json({
        error: "Velocity did not return a payment URL for card transaction. Please try a different payment method.",
      }, { status: 502 })
    }

    return NextResponse.json({
      success: true,
      paymentMethod: isCard ? "CARD" : "ECOCASH",
      orderId,
      salesOrderTrace,
      transactionTrace: transaction.body.trace,
      flow: isCard ? "velocity-redirect" : "velocity-seamless",
      pollRequired: isCard ? undefined : true,
      redirectUrl: redirectUrl ?? null,
      amount: total,
      currency,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Checkout failed"
    log.error("velocity checkout failed", { orderId, error: message })
    await db
      .update(orders)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(eq(orders.id, orderId))
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
