import { NextResponse } from "next/server"
import { z } from "zod"
import { eq, and, inArray, desc, sql } from "drizzle-orm"
import { db } from "@/db"
import { events, merchItems, orders, orderItems, ticketTiers, vendorListings, vendors, promoCodes, ticketQuestions } from "@/db/schema"
import { checkoutLimiter } from "@/lib/rate-limit"
import { getConfig, initiateTransaction, createSalesOrder, getAuthType, getDefaultCustomerId, pollTransaction, extractHostedSessionId } from "@/services/velocity"
import { validateTransactionPayload, formatPhone } from "@/lib/velocity/validation"
import { withLock } from "@/lib/velocity/idempotency"
import { deliverTicketForPaidOrder } from "@/lib/delivery"
import { log } from "@/lib/logger"
import { trackEvent } from "@/lib/analytics"
import { getBaseUrl } from "@/lib/url-config"
import { getTierAvailability } from "@/lib/ticket-availability"
import { alertTransactionFailed, alertPaymentAnomaly } from "@/lib/payment-alerts"
import { sendAdminAlert } from "@/lib/whatsapp"
import { freeOrderAlert } from "@/lib/whatsapp-templates"
import type { VelocityOrderMetadata, VelocityPollStatus, InitiateTransactionPayload } from "@/types/velocity"

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
    "url",
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

function getVelocityTransactionTrace(transaction: {
  body?: { trace?: string | null } | null
  externalId?: string | null
}): string | null {
  return transaction.body?.trace ?? transaction.externalId ?? null
}

/**
 * Recover the hosted checkout redirect URL for an existing card transaction.
 *
 * When a card order is resumed (e.g. page refresh / double-click), Velocity has
 * already created the transaction but the redirect URL was not persisted. We
 * re-poll the transaction and re-initiate a fresh transaction to get a new
 * redirect URL from Velocity.
 *
 * Returns the URL (when available) plus the trace/recovery state to persist.
 */
type CardRedirectRecovery = {
  redirectUrl: string | null
  transactionTrace: string | null
  transactionId: string | null
  attempted: boolean
}

async function recoverCardRedirectUrl(
  transactionTrace: string,
  salesOrderTrace: string,
  salesOrderId: string | undefined,
  orderId: string,
  recoveryAttempted: boolean,
): Promise<CardRedirectRecovery> {
  try {
    // First try: poll the existing transaction — Velocity may embed the redirect
    // URL in the poll response.
    const pollResult = await pollTransaction(transactionTrace)
    const pollRedirect = extractRedirectUrl(pollResult as unknown as Record<string, unknown>)
    if (pollRedirect) {
      log.info("velocity checkout - recovered redirect URL from poll", { orderId, transactionTrace })
      return {
        redirectUrl: pollRedirect,
        transactionTrace: null,
        transactionId: pollResult.body?.id ?? null,
        attempted: recoveryAttempted,
      }
    }

    // Second try: re-initiate a new transaction against the same sales order.
    // Only possible if we have the Velocity sales order UUID. Velocity will
    // generate a fresh hosted checkout session with a new redirect URL.
    if (salesOrderId && !recoveryAttempted) {
      const config = getConfig()
      const txPayload: InitiateTransactionPayload = {
        amount: 0, // amount is on the sales order; Velocity reads from it
        paymentProcessorLabel: "VMC",
        debitPhone: config.merchantPhone || "+263000000000",
        debitRegion: "ZW",
        debitCurrency: "USD",
        debitRef: orderId,
        creditPhone: config.merchantPhone,
        creditRegion: "ZW",
        creditAccount: config.merchantPhone,
        type: "REQUEST",
        authType: "WEB",
        salesOrderId,
        returnUrl: `${getBaseUrl()}/api/checkout/velocity/return/${orderId}`,
      }
      const newTx = await initiateTransaction(txPayload)
      const newRedirect = extractRedirectUrl(newTx as unknown as Record<string, unknown>)
      const newTrace = getVelocityTransactionTrace(newTx)
      if (newRedirect) {
        log.info("velocity checkout - recovered redirect URL from re-initiated transaction", {
          orderId,
          transactionTrace,
          newRedirectPreview: `${newRedirect.slice(0, 80)}...`,
        })
        return {
          redirectUrl: newRedirect,
          transactionTrace: newTrace,
          transactionId: newTx.body?.id ?? null,
          attempted: true,
        }
      }
      return { redirectUrl: null, transactionTrace: newTrace, transactionId: newTx.body?.id ?? null, attempted: true }
    }

    log.warn("velocity checkout - could not recover redirect URL for card order", {
      orderId,
      transactionTrace,
      salesOrderTrace,
      hasSalesOrderId: !!salesOrderId,
    })
    return { redirectUrl: null, transactionTrace: null, transactionId: null, attempted: recoveryAttempted }
  } catch (err) {
    log.error("velocity checkout - redirect URL recovery failed", {
      orderId,
      transactionTrace,
      error: err instanceof Error ? err.message : String(err),
    })
    return { redirectUrl: null, transactionTrace: null, transactionId: null, attempted: recoveryAttempted }
  }
}

// Maximum retry attempts for Velocity card transactions that fail to return
// a hosted checkout redirect URL. Each retry re-initiates a new transaction.
const VMC_REDIRECT_RETRIES = 2

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

const MerchItem = z.object({
  kind: z.literal("merch"),
  itemId: z.string().uuid(),
  quantity: z.number().int().positive().max(10),
  size: z.string().max(40).optional(),
})

const Body = z.object({
  email: z.string().email().toLowerCase().trim(),
  name: z.string().min(1).max(120).trim(),
  phone: z.string().max(40).trim().optional().default(""),
  paymentMethod: z.enum(["velocity-ecocash", "velocity-card"]),
  eventSlug: z.string().min(1).max(160),
  items: z
    .array(z.discriminatedUnion("kind", [TicketItem, VendorAddonItem, MerchItem]))
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
  let rawBody: unknown
  try {
    rawBody = await req.json()
    parsed = Body.parse(rawBody)
  } catch (err) {
    const detail = err instanceof Error ? err.message : null
    // Log full validation failure for debugging
    if (err instanceof z.ZodError) {
      console.error("[checkout] validation failed:", JSON.stringify(err.issues))
    }
    return NextResponse.json(
      { error: "Invalid request — " + (detail ?? "check your details and try again") },
      { status: 400 },
    )
  }

  const [event] = await db.select().from(events).where(eq(events.slug, parsed.eventSlug)).limit(1)
  if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 })

  const now = new Date()
  const eventEndedAt = event.endsAt ?? event.startsAt
  if (eventEndedAt && new Date(eventEndedAt) < now) {
    return NextResponse.json({ error: "Ticket sales for this event have ended" }, { status: 400 })
  }

  if (event.status !== "published") {
    return NextResponse.json({ error: "This event is not currently available for purchase" }, { status: 400 })
  }

  const ticketItems = parsed.items.filter((i): i is typeof i & { kind: "ticket" } => i.kind === "ticket")
  const vendorAddonItems = parsed.items.filter((i): i is typeof i & { kind: "vendor_addon" } => i.kind === "vendor_addon")
  const merchOrderItems = parsed.items.filter((i): i is typeof i & { kind: "merch" } => i.kind === "merch")

  // Velocity sales orders need at least one ticket item to compute a valid unit price.
  if (ticketItems.length === 0) {
    return NextResponse.json({ error: "At least one ticket is required" }, { status: 400 })
  }

  // Fetch tiers and vendor addon prices in parallel — independent queries
  const [tiers, listingRows, merchRows] = await Promise.all([
    db.select().from(ticketTiers).where(eq(ticketTiers.eventId, event.id)),
    vendorAddonItems.length > 0
      ? db
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
      : Promise.resolve([] as { id: string; price: unknown; currency: string | null; packageName: string; businessName: string | null }[]),
    merchOrderItems.length > 0
      ? db
          .select({
            id: merchItems.id,
            name: merchItems.name,
            price: merchItems.price,
            currency: merchItems.currency,
            sizes: merchItems.sizes,
            stockQuantity: merchItems.stockQuantity,
            soldQuantity: merchItems.soldQuantity,
          })
          .from(merchItems)
          .where(and(eq(merchItems.eventId, event.id), eq(merchItems.active, true), inArray(merchItems.id, merchOrderItems.map((i) => i.itemId))))
      : Promise.resolve([] as { id: string; name: string; price: unknown; currency: string | null; sizes: string[] | null; stockQuantity: number | null; soldQuantity: number | null }[]),
  ])

  const availabilityByTier = await getTierAvailability(tiers.map((t) => t.id))
  const saleTiers = tiers.map((tier) => ({
    ...tier,
    soldQuantity: availabilityByTier.get(tier.id)?.usedQuantity ?? tier.soldQuantity ?? 0,
  }))
  const tierById = new Map(saleTiers.map((t) => [t.id, t]))

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

  const merchById = new Map(merchRows.map((item) => [item.id, item]))
  for (const item of merchOrderItems) {
    const merch = merchById.get(item.itemId)
    if (!merch) return NextResponse.json({ error: "Merch item is no longer available" }, { status: 400 })
    if (item.size && !(merch.sizes ?? []).includes(item.size)) {
      return NextResponse.json({ error: `Size ${item.size} is not available for ${merch.name}` }, { status: 400 })
    }
    const available = Number(merch.stockQuantity ?? 0) - Number(merch.soldQuantity ?? 0)
    if (available < item.quantity) {
      return NextResponse.json({ error: `Only ${Math.max(0, available)} ${merch.name} item(s) left` }, { status: 400 })
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
  for (const item of merchOrderItems) {
    const merch = merchById.get(item.itemId)!
    allCurrencies.add(merch.currency ?? "USD")
  }

  if (allCurrencies.size > 1) {
    return NextResponse.json({ error: "Mixed-currency cart not supported yet" }, { status: 400 })
  }
  const currency = [...allCurrencies][0] ?? "USD"

  // Compute effective price — uses early bird or group discount when applicable
  function effectivePrice(t: typeof tiers[number], quantity: number): number {
    // Early bird takes priority
    if (t.earlyBirdPrice) {
      const dateExpired = t.earlyBirdUntil && new Date() >= new Date(t.earlyBirdUntil)
      const qtyExpired = t.earlyBirdQuantity !== null && (t.soldQuantity ?? 0) >= t.earlyBirdQuantity
      if (!dateExpired && !qtyExpired) return Number(t.earlyBirdPrice)
    }
    // Group / volume discount applies when quantity meets the threshold
    if (t.groupPrice && t.groupMinQty && quantity >= t.groupMinQty) {
      return Number(t.groupPrice)
    }
    return Number(t.price)
  }

  let total = 0
  for (const item of ticketItems) {
    const t = tierById.get(item.tierId)!
    total += effectivePrice(t, item.quantity) * item.quantity
  }
  for (const item of vendorAddonItems) {
    const v = vendorAddonPrices.get(item.listingId)!
    total += v.price * item.quantity
  }
  for (const item of merchOrderItems) {
    const merch = merchById.get(item.itemId)!
    total += Number(merch.price) * item.quantity
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
  const eventQuestionsList = await db
    .select({ id: ticketQuestions.id, required: ticketQuestions.required })
    .from(ticketQuestions)
    .where(eq(ticketQuestions.eventId, event.id))
  const questionResponses = parsed.questionResponses ?? {}
  const questionMap = new Map(eventQuestionsList.map((q) => [q.id, q]))
  for (const [qid, answer] of Object.entries(questionResponses)) {
    const q = questionMap.get(qid)
    if (!q) return NextResponse.json({ error: `Invalid question ID: ${qid}` }, { status: 400 })
    if (q.required && !answer.trim()) {
      return NextResponse.json({ error: "Required question missing answer" }, { status: 400 })
    }
  }
  for (const q of eventQuestionsList) {
    if (q.required && !questionResponses[q.id]?.trim()) {
      return NextResponse.json({ error: "Required question missing answer" }, { status: 400 })
    }
  }
  if (Object.keys(questionResponses).length > 0) questionResponseMeta = questionResponses

  const baseMeta = {
    ...(appliedPromo ? { promo: appliedPromo } : {}),
    ...(questionResponseMeta ? { questionResponses: questionResponseMeta } : {}),
    ...(merchOrderItems.length > 0
      ? { merchSelections: merchOrderItems.map((item) => ({ itemId: item.itemId, size: item.size ?? null })) }
      : {}),
    // Phase 2 rewrites order metadata from baseMeta, so the reservation flag
    // must live here — otherwise it's wiped after order creation, delivery
    // double-increments soldQuantity, and expiry never releases the seats.
    inventoryReserved: true,
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

    // For card payments, attempt to recover the redirect URL so the buyer
    // actually gets sent to Velocity's hosted checkout instead of being
    // stuck in a polling loop for a payment they can't complete.
    let resumeRedirectUrl: string | null = vm.redirectUrl ?? null
    if (isCard && !resumeRedirectUrl && vm.transactionTrace) {
      const recovery = await recoverCardRedirectUrl(
        vm.transactionTrace,
        vm.salesOrderTrace,
        vm.salesOrderId ?? undefined,
        resumable.id,
        vm.redirectRecoveryAttempted === true,
      )
      resumeRedirectUrl = recovery.redirectUrl
      // Persist recovery state and any newly-issued trace so a page refresh
      // cannot create another remote card transaction indefinitely.
      if (recovery.attempted || recovery.transactionTrace || recovery.redirectUrl) {
        const transactionTraces = Array.from(new Set([
          ...(vm.transactionTraces ?? []),
          vm.transactionTrace,
          recovery.transactionTrace,
        ].filter((trace): trace is string => Boolean(trace))))
        await db
          .update(orders)
          .set({
            metadata: {
              ...meta,
              velocity: {
                ...vm,
                redirectUrl: resumeRedirectUrl,
                transactionId: recovery.transactionId ?? vm.transactionId ?? null,
                transactionSessionId: extractHostedSessionId(resumeRedirectUrl),
                transactionTrace: recovery.transactionTrace ?? vm.transactionTrace,
                transactionTraces,
                redirectRecoveryAttempted: recovery.attempted,
              },
            },
            updatedAt: new Date(),
          })
          .where(eq(orders.id, resumable.id))
      }
    }

    return NextResponse.json({
      success: true,
      paymentMethod: isCard ? "CARD" : "ECOCASH",
      orderId: resumable.id,
      salesOrderTrace: vm.salesOrderTrace,
      transactionTrace: vm.transactionTrace,
      flow: isCard ? "velocity-redirect" : "velocity-seamless",
      pollRequired: isCard ? undefined : true,
      redirectUrl: resumeRedirectUrl,
      amount: Number(resumable.totalAmount),
      currency: resumable.currency ?? currency,
      resumed: true,
    })
  }

  // ── Phase 1: Create order atomically under lock ────────────────────────────
  // withLock uses pg_try_advisory_xact_lock (transaction-scoped) — the lock
  // auto-releases on commit. DB writes are atomic; HTTP calls happen after.
  const lockKey = `velocity-checkout:event:${event.id}`

  let creation: { orderId: string } | null
  try {
    creation = await withLock(lockKey, async (tx) => {
      const latestAvailability = await getTierAvailability(ticketItems.map((item) => item.tierId))
      for (const item of ticketItems) {
        const tier = tierById.get(item.tierId)!
        const availability = latestAvailability.get(item.tierId)
        const availableQuantity = availability?.availableQuantity ?? 0
        if (availableQuantity < item.quantity) {
          throw new Error(
            availableQuantity <= 0
              ? `"${tier.name}" is sold out`
              : `Only ${availableQuantity} ticket(s) left for "${tier.name}"`,
          )
        }
      }

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
          metadata: { ...baseMeta, inventoryReserved: true },
        })
        .returning({ id: orders.id })

      const orderItemValues: {
        orderId: string
        tierId?: string
        merchItemId?: string
        type: string
        quantity: number
        unitPrice: string
        total: string
      }[] = []

      for (const item of ticketItems) {
        const t = tierById.get(item.tierId)!
        const unit = effectivePrice(t, item.quantity)
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
          merchItemId: item.listingId,
          type: "vendor_addon",
          quantity: item.quantity,
          unitPrice: v.price.toFixed(2),
          total: (v.price * item.quantity).toFixed(2),
        })
      }

      for (const item of merchOrderItems) {
        const merch = merchById.get(item.itemId)!
        orderItemValues.push({
          orderId: order.id,
          merchItemId: merch.id,
          type: "merch",
          quantity: item.quantity,
          unitPrice: Number(merch.price).toFixed(2),
          total: (Number(merch.price) * item.quantity).toFixed(2),
        })
      }

      await tx.insert(orderItems).values(orderItemValues)

      // ── Inventory reservation ─────────────────────────────────────────────
      // The event-level advisory lock above serializes checkout reservations.
      // We store the fresh computed usage back into soldQuantity so legacy
      // admin views stay close to the source-of-truth availability calculation.
      for (const item of ticketItems) {
        const tier = tierById.get(item.tierId)!
        const baselineUsed = latestAvailability.get(item.tierId)?.usedQuantity ?? Number(tier.soldQuantity ?? 0)
        const [reserved] = await tx
          .update(ticketTiers)
          .set({ soldQuantity: baselineUsed + item.quantity })
          .where(eq(ticketTiers.id, item.tierId))
          .returning({ id: ticketTiers.id })

        if (!reserved) {
          throw new Error(`"${tier.name}" just sold out — please choose fewer tickets or a different tier`)
        }
      }

      for (const item of merchOrderItems) {
        const merch = merchById.get(item.itemId)!
        const [reserved] = await tx
          .update(merchItems)
          .set({ soldQuantity: sql`${merchItems.soldQuantity} + ${item.quantity}` })
          .where(and(
            eq(merchItems.id, merch.id),
            sql`COALESCE(${merchItems.soldQuantity}, 0) + ${item.quantity} <= COALESCE(${merchItems.stockQuantity}, 0)`,
          ))
          .returning({ id: merchItems.id })
        if (!reserved) throw new Error(`"${merch.name}" just sold out — please try again`)
      }

      if (appliedPromo) {
        await tx
          .update(promoCodes)
          .set({ usedCount: sql`${promoCodes.usedCount} + 1` })
          .where(eq(promoCodes.id, appliedPromo.id))
      }

      return { orderId: order.id }
    })
  } catch (err) {
    // Reservation failed (tier sold out) or DB error — surface as 409
    const msg = err instanceof Error ? err.message : "Checkout failed"
    log.warn("velocity checkout - order creation failed", { error: msg, email: parsed.email, eventId: event.id })
    return NextResponse.json({ error: msg }, { status: 409 })
  }

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

      // Recover redirect URL for card orders (same logic as primary resume path)
      let resumeRedirectUrl = vm.redirectUrl ?? null
      if (isCard && !resumeRedirectUrl && vm.transactionTrace) {
        const recovery = await recoverCardRedirectUrl(
          vm.transactionTrace,
          vm.salesOrderTrace,
          vm.salesOrderId ?? undefined,
          concurrent.id,
          vm.redirectRecoveryAttempted === true,
        )
        resumeRedirectUrl = recovery.redirectUrl
        if (recovery.attempted || recovery.transactionTrace || recovery.redirectUrl) {
          const transactionTraces = Array.from(new Set([
            ...(vm.transactionTraces ?? []),
            vm.transactionTrace,
            recovery.transactionTrace,
          ].filter((trace): trace is string => Boolean(trace))))
          await db
            .update(orders)
            .set({
              metadata: {
                ...meta,
                velocity: {
                  ...vm,
                  redirectUrl: resumeRedirectUrl,
                  transactionId: recovery.transactionId ?? vm.transactionId ?? null,
                  transactionSessionId: extractHostedSessionId(resumeRedirectUrl),
                  transactionTrace: recovery.transactionTrace ?? vm.transactionTrace,
                  transactionTraces,
                  redirectRecoveryAttempted: recovery.attempted,
                },
              },
              updatedAt: new Date(),
            })
            .where(eq(orders.id, concurrent.id))
        }
      }

      return NextResponse.json({
        success: true,
        paymentMethod: isCard ? "CARD" : "ECOCASH",
        orderId: concurrent.id,
        salesOrderTrace: vm.salesOrderTrace,
        transactionTrace: vm.transactionTrace,
        flow: isCard ? "velocity-redirect" : "velocity-seamless",
        pollRequired: isCard ? undefined : true,
        redirectUrl: resumeRedirectUrl,
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

  // Cancels the order AND releases the inventory reservation so seats aren't
  // locked forever. Called on any Phase 2 failure (validation, config, API error).
  const cancelWithInventoryRelease = async () => {
    try {
      const items = await db
        .select({ tierId: orderItems.tierId, quantity: orderItems.quantity })
        .from(orderItems)
        .where(eq(orderItems.orderId, orderId))
      for (const item of items) {
        if (item.tierId) {
          await db
            .update(ticketTiers)
            .set({ soldQuantity: sql`GREATEST(0, ${ticketTiers.soldQuantity} - ${item.quantity})` })
            .where(eq(ticketTiers.id, item.tierId))
        }
      }
      // Revert promo usedCount if a promo code was applied
      if (appliedPromo) {
        await db
          .update(promoCodes)
          .set({ usedCount: sql`GREATEST(0, ${promoCodes.usedCount} - 1)` })
          .where(eq(promoCodes.id, appliedPromo.id))
      }
    } catch (releaseErr) {
      log.error("checkout - inventory release failed during cancel", { orderId, error: String(releaseErr) })
    }
    await db.update(orders).set({ status: "cancelled", updatedAt: new Date() }).where(eq(orders.id, orderId))
  }

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

      // Fire-and-forget — order is already marked paid so the cron will retry
    // via EMAIL_FAILED/FAILED if delivery fails. No need to block the response.
    deliverTicketForPaidOrder(orderId).catch((err) =>
      log.error("velocity checkout - free order delivery failed", { orderId, error: String(err) }),
    )

    trackEvent({ event: "PAYMENT_CONFIRMED", eventId: event.id, orderId, paymentMethod: parsed.paymentMethod, amount: 0 })

    // WhatsApp admin alert for free order (fire-and-forget)
    sendAdminAlert(
      freeOrderAlert(event.title, parsed.name ?? parsed.email ?? "Anonymous", parsed.phone ?? "—", orderId),
    ).catch((err) =>
      log.error("whatsapp admin alert failed for free order", {
        orderId,
        error: String(err),
      }),
    )

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
      await cancelWithInventoryRelease()
      return NextResponse.json({ error: validationError }, { status: 400 })
    }

    if (!config.merchantPhone) {
      await cancelWithInventoryRelease()
      return NextResponse.json({ error: "Merchant phone not configured" }, { status: 500 })
    }

    const isCard = processor === "VMC"

    const returnUrlFields: Record<string, string | undefined> = {}
    if (isCard) {
      const base = `${getBaseUrl()}/api/checkout/velocity`
      returnUrlFields.returnUrl = `${base}/return/${orderId}`
      returnUrlFields.successUrl = `${base}/return/${orderId}`
      returnUrlFields.cancelUrl = `${getBaseUrl()}/orders/${orderId}?error=cancelled`
    }

    // For card (VMC) payments, use the merchant phone as a fallback if the
    // buyer's phone is empty or invalid — Velocity still requires a debitPhone
    // value, but it's not used for a USSD prompt.
    const effectivePhone = formattedPhone || config.merchantPhone || "+263000000000"

    const transactionPayload = {
      amount: total,
      paymentProcessorLabel: processor,
      debitPhone: effectivePhone,
      debitRegion: "ZW",
      debitCurrency: currency as "USD" | "ZWG",
      debitRef: orderId,
      creditPhone: config.merchantPhone,
      creditRegion: "ZW",
      creditAccount: config.merchantPhone,
      type: "REQUEST",
      authType,
      salesOrderId,
      ...returnUrlFields,
    }

    log.info("velocity checkout - initiating transaction", { orderId, salesOrderId, processor, amount: total, authType })

    // For VMC (card) payments, retry the transaction initiation up to
    // VMC_REDIRECT_RETRIES times if Velocity returns no hosted checkout URL.
    // Velocity's card gateway is known to intermittently omit the redirect,
    // so a fresh transaction against the same sales order usually succeeds.
    let transaction = await initiateTransaction(transactionPayload)
    let redirectUrl = extractRedirectUrl(transaction as unknown as Record<string, unknown>)
    let transactionBody = transaction.body ?? null
    let transactionTrace = getVelocityTransactionTrace(transaction)
    const transactionTraces = transactionTrace ? [transactionTrace] : []

    if (isCard && !redirectUrl && transactionTrace) {
      for (let attempt = 1; attempt <= VMC_REDIRECT_RETRIES; attempt++) {
        log.warn("velocity checkout - card payment missing redirect URL, retrying", {
          orderId,
          attempt,
          maxRetries: VMC_REDIRECT_RETRIES,
          transactionTrace,
        })
        // Brief delay before retry to avoid hitting Velocity rate limits
        await new Promise((r) => setTimeout(r, 1000 * attempt))
        try {
          const retryTx = await initiateTransaction(transactionPayload)
          const retryUrl = extractRedirectUrl(retryTx as unknown as Record<string, unknown>)
          if (retryUrl) {
            log.info("velocity checkout - redirect URL recovered on retry", {
              orderId,
              attempt,
              retryRedirectPreview: `${retryUrl.slice(0, 80)}...`,
            })
            transaction = retryTx
            redirectUrl = retryUrl
            transactionBody = retryTx.body ?? null
            transactionTrace = getVelocityTransactionTrace(retryTx)
            if (transactionTrace && !transactionTraces.includes(transactionTrace)) transactionTraces.push(transactionTrace)
            break
          }
          // Update trace if first attempt had none but retry did
          if (!transactionTrace) {
            transactionTrace = getVelocityTransactionTrace(retryTx)
          }
          const retryTrace = getVelocityTransactionTrace(retryTx)
          if (retryTrace && !transactionTraces.includes(retryTrace)) transactionTraces.push(retryTrace)
        } catch (retryErr) {
          log.warn("velocity checkout - redirect URL retry attempt failed", {
            orderId,
            attempt,
            error: retryErr instanceof Error ? retryErr.message : String(retryErr),
          })
        }
      }
    }

    const pollStatus = (transactionBody?.pollStatus ?? "PENDING") as VelocityPollStatus

    log.info("velocity checkout - transaction response", {
        orderId,
        processor,
        authType,
        trace: transactionTrace,
        pollStatus,
        paymentStatus: transactionBody?.paymentStatus ?? null,
        externalId: transaction.externalId ?? null,
        redirectUrlFound: !!redirectUrl,
        redirectUrlPreview: redirectUrl ? `${redirectUrl.slice(0, 80)}...` : null,
        bodyType: transactionBody === null ? "null" : typeof transactionBody,
        allBodyKeys: transactionBody ? Object.keys(transactionBody).join(", ") : "",
        allResponseKeys: Object.keys(transaction).join(", "),
        message: transaction.message ?? null,
      })

    if (!transactionTrace) {
      await db
        .update(orders)
        .set({
          metadata: {
            ...baseMeta,
            velocity: {
              salesOrderTrace,
              transactionTrace: null,
              transactionId: transactionBody?.id ?? null,
              transactionSessionId: extractHostedSessionId(redirectUrl ?? null),
              outstandingAmount: total,
              paymentProcessor: processor,
              pollStatus: "UNKNOWN" as VelocityPollStatus,
              paymentStatus: null,
              paymentRef: null,
              invoiceRef: null,
              initiatedAt: new Date().toISOString(),
              finalizedAt: null,
              failureReason: "Velocity did not return a transaction trace",
            },
          },
          updatedAt: new Date(),
        })
        .where(eq(orders.id, orderId))

      log.error("velocity checkout - transaction missing trace", {
        orderId,
        processor,
        authType,
        responseBody: JSON.stringify(transaction).slice(0, 2000),
      })

      // Fire alert for missing transaction trace
      alertTransactionFailed(
        "Transaction missing trace",
        orderId,
        parsed.paymentMethod,
        { processor, authType, responseBodyPreview: JSON.stringify(transaction).slice(0, 500) },
      )

      const userMsg = isCard
        ? "The card payment service did not return a transaction reference. No charge has been made. Please try again or choose a different payment method."
        : "The payment service did not return a transaction reference. Please try again."
      return NextResponse.json({
        error: userMsg,
      }, { status: 502 })
    }

    const velocityMeta: VelocityOrderMetadata = {
      salesOrderTrace,
      salesOrderId,
      transactionTrace,
      transactionId: transactionBody?.id ?? null,
      transactionSessionId: extractHostedSessionId(redirectUrl ?? null),
      transactionTraces,
      redirectRecoveryAttempted: false,
      outstandingAmount: total,
      paymentProcessor: processor,
      pollStatus,
      paymentStatus: transactionBody?.paymentStatus ?? null,
      paymentRef: null,
      invoiceRef: null,
      initiatedAt: new Date().toISOString(),
      finalizedAt: null,
      redirectUrl: redirectUrl ?? null,
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
      log.error("velocity checkout - card payment missing redirect URL after retries", {
        orderId,
        processor,
        authType,
        transactionTrace: transactionTrace ?? "(no trace)",
        retriesAttempted: VMC_REDIRECT_RETRIES,
        transactionBody: transactionBody ? JSON.stringify(transactionBody).slice(0, 2000) : "null",
        allResponseKeys: Object.keys(transaction).join(", "),
      })

      // Fire alert for missing card redirect URL
      alertTransactionFailed(
        `Card payment missing redirect URL after ${VMC_REDIRECT_RETRIES} retries (transactionTrace: ${transactionTrace ?? "none"})`,
        orderId,
        parsed.paymentMethod,
        {
          processor,
          authType,
          hasTransactionTrace: !!transactionTrace,
          retriesAttempted: VMC_REDIRECT_RETRIES,
          responseBodyKeys: Object.keys(transaction).join(", "),
        },
      )

      return NextResponse.json({
        error: "The card payment provider did not return a checkout page. Your order is being held for reconciliation; try again shortly or choose EcoCash.",
        orderId,
        recoverable: true,
      }, { status: 502 })
    }

    return NextResponse.json({
      success: true,
      paymentMethod: isCard ? "CARD" : "ECOCASH",
      orderId,
      salesOrderTrace,
      transactionTrace,
      flow: isCard ? "velocity-redirect" : "velocity-seamless",
      pollRequired: isCard ? undefined : true,
      redirectUrl: redirectUrl ?? null,
      amount: total,
      currency,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Checkout failed"
    log.error("velocity checkout failed", { orderId, error: message })

    // Alert on Velocity API errors during checkout — medium severity since
    // these are transient network errors the buyer can retry themselves.
    alertPaymentAnomaly({
      type: "TRANSACTION_API_ERROR",
      severity: "medium",
      title: "Velocity API error during checkout",
      detail: `Checkout for order ${orderId} (${parsed.paymentMethod}) hit a Velocity API error: ${message.slice(0, 300)}. The buyer was shown an error and can retry.`,
      orderId,
      paymentMethod: parsed.paymentMethod,
      context: { errorMessage: message.slice(0, 500) },
    }).catch(() => {})

    await cancelWithInventoryRelease()
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
