import { CheckoutBody, checkoutFingerprint as makeCheckoutFingerprint, quoteMatches } from "@/lib/checkout-contract"
import { NextResponse } from "next/server"
import { z } from "zod"
import { eq, and, inArray, desc, sql } from "drizzle-orm"
import { db } from "@/db"
import { events, merchItems, orders, orderItems, ticketTiers, vendorListings, vendors, ticketQuestions } from "@/db/schema"
import { checkoutSubmitLimiter } from "@/lib/rate-limit"
import { getConfig, initiateTransaction, createSalesOrder, getAuthType, getDefaultCustomerId, pollTransaction, getTransactionRedirectUrl, extractHostedSessionId } from "@/services/velocity"
import { validateTransactionPayload, formatPhone } from "@/lib/velocity/validation"
import { lockOrderMutation, withLock, type DbTx } from "@/lib/velocity/idempotency"
import { deliverTicketForPaidOrder } from "@/lib/delivery"
import { cancelUnpaidOrderAndReleaseInventory } from "@/lib/order-expiry"
import { isDefinitiveRejection, VelocityApiError } from "@/lib/velocity/api-error"
import { log } from "@/lib/logger"
import { trackEvent } from "@/lib/analytics"
import { getBaseUrl } from "@/lib/url-config"
import { generateOrderAccessUrl, signTicketPayload } from "@/lib/tickets"
import { getTierAvailability } from "@/lib/ticket-availability"
import { alertTransactionFailed, alertPaymentAnomaly } from "@/lib/payment-alerts"
import { sendAdminAlert } from "@/lib/whatsapp"
import { freeOrderAlert } from "@/lib/whatsapp-templates"
import { calculateGatewayFee, calculateGatewayCharge, GATEWAY_FEE_PERCENT, GATEWAY_MARKUP_PERCENT } from "@/lib/gateway-fee"
import type {
  VelocityOrderMetadata,
  VelocityPollStatus,
  VelocityTransactionAttempt,
} from "@/types/velocity"

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
  amount: number,
  currency: "USD" | "ZWG",
  transactionId?: string | null,
  transactionSessionId?: string | null,
): Promise<CardRedirectRecovery> {
  try {
    // First try: poll the existing transaction — Velocity may embed the redirect
    // URL in the poll response.
    const pollResult = await pollTransaction(transactionTrace, { transactionId, transactionSessionId })
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

    // Velocity documents a read-only session lookup for hosted redirect recovery.
    if (transactionSessionId) {
      const redirectUrl = await getTransactionRedirectUrl(transactionSessionId)
      if (redirectUrl) return { redirectUrl, transactionTrace: null, transactionId: transactionId ?? null, attempted: true }
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

function mergeVelocityAttempts(
  ...attemptGroups: Array<Array<VelocityTransactionAttempt | null | undefined> | undefined>
): VelocityTransactionAttempt[] {
  const merged = new Map<string, VelocityTransactionAttempt>()
  for (const attempt of attemptGroups.flatMap((group) => group ?? [])) {
    if (!attempt) continue
    const key = attempt.transactionTrace
      ? `trace:${attempt.transactionTrace}`
      : attempt.transactionId
        ? `id:${attempt.transactionId}`
        : attempt.transactionSessionId
          ? `session:${attempt.transactionSessionId}`
          : null
    if (key) merged.set(key, attempt)
  }
  return [...merged.values()].slice(-20)
}

function velocityAttempt(
  transaction: { body?: { trace?: string | null; id?: string | null } | null; externalId?: string | null },
  redirectUrl: string | null | undefined,
  source: string,
): VelocityTransactionAttempt | null {
  const transactionTrace = getVelocityTransactionTrace(transaction)
  const transactionId = transaction.body?.id ?? null
  const transactionSessionId = extractHostedSessionId(redirectUrl)
  if (!transactionTrace && !transactionId && !transactionSessionId) return null
  return {
    transactionTrace,
    transactionId,
    transactionSessionId,
    initiatedAt: new Date().toISOString(),
    source,
  }
}

type PersistedCardRecovery = {
  redirectUrl: string | null
  transactionTrace: string | null
  inProgress: boolean
  recoverable: boolean
}

/**
 * Claim card recovery under the shared order lock, perform provider I/O after
 * releasing the DB transaction, then merge the resulting attempt back under
 * the same lock. The lease prevents duplicate remote replacement sessions
 * without holding a database connection during network I/O.
 */
async function recoverAndPersistCardRedirect(
  orderId: string,
  fallbackCurrency: "USD" | "ZWG",
): Promise<PersistedCardRecovery> {
  const claimToken = crypto.randomUUID()
  const claim = await db.transaction(async (tx) => {
    await lockOrderMutation(tx, orderId)
    const [current] = await tx
      .select({
        status: orders.status,
        totalAmount: orders.totalAmount,
        currency: orders.currency,
        metadata: orders.metadata,
      })
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1)
    const metadata = (current?.metadata ?? {}) as Record<string, unknown> & { velocity?: VelocityOrderMetadata }
    const velocity = metadata.velocity
    if (!current || !velocity?.transactionTrace || !velocity.salesOrderTrace) return null
    if (!["pending", "awaiting_verification"].includes(current.status ?? "")) return null

    const failedSession = velocity.paymentStatus !== "SUCCESS" &&
      ["FAILED", "TIMEOUT"].includes(velocity.pollStatus ?? "")
    if (velocity.redirectUrl && !failedSession) {
      return { current, metadata, velocity, failedSession, alreadyReady: true }
    }

    const claimedAt = velocity.redirectRecoveryInProgressAt
      ? new Date(velocity.redirectRecoveryInProgressAt).getTime()
      : 0
    if (velocity.redirectRecoveryToken && Date.now() - claimedAt < 2 * 60 * 1000) {
      return { current, metadata, velocity, failedSession, alreadyReady: false, inProgress: true }
    }

    const nextVelocity: VelocityOrderMetadata = {
      ...velocity,
      redirectRecoveryToken: claimToken,
      redirectRecoveryInProgressAt: new Date().toISOString(),
    }
    await tx
      .update(orders)
      .set({ metadata: { ...metadata, velocity: nextVelocity }, updatedAt: new Date() })
      .where(eq(orders.id, orderId))
    return { current, metadata, velocity: nextVelocity, failedSession, alreadyReady: false, inProgress: false }
  })

  if (!claim) return { redirectUrl: null, transactionTrace: null, inProgress: false, recoverable: false }
  if (claim.alreadyReady) {
    return {
      redirectUrl: claim.velocity.redirectUrl ?? null,
      transactionTrace: claim.velocity.transactionTrace,
      inProgress: false,
      recoverable: true,
    }
  }
  if (claim.inProgress) {
    return {
      redirectUrl: claim.velocity.redirectUrl ?? null,
      transactionTrace: claim.velocity.transactionTrace,
      inProgress: true,
      recoverable: true,
    }
  }

  const recovery = await recoverCardRedirectUrl(
    claim.velocity.transactionTrace!,
    claim.velocity.salesOrderTrace,
    claim.velocity.salesOrderId ?? undefined,
    orderId,
    claim.velocity.redirectRecoveryAttempted === true,
    Number(claim.current.totalAmount),
    (claim.current.currency ?? fallbackCurrency) as "USD" | "ZWG",
    claim.velocity.transactionId,
    claim.velocity.transactionSessionId,
  )
  const recoverySessionId = extractHostedSessionId(recovery.redirectUrl)
  const newAttempt = recovery.transactionTrace || recovery.transactionId || recoverySessionId
    ? {
        transactionTrace: recovery.transactionTrace,
        transactionId: recovery.transactionId,
        transactionSessionId: recoverySessionId,
        initiatedAt: new Date().toISOString(),
        source: "redirect_recovery",
      } satisfies VelocityTransactionAttempt
    : null

  return db.transaction(async (tx) => {
    await lockOrderMutation(tx, orderId)
    const [current] = await tx.select().from(orders).where(eq(orders.id, orderId)).limit(1)
    const metadata = (current?.metadata ?? {}) as Record<string, unknown> & { velocity?: VelocityOrderMetadata }
    const velocity = metadata.velocity
    if (!current || !velocity) {
      return { redirectUrl: null, transactionTrace: null, inProgress: false, recoverable: false }
    }

    const currentAttempt: VelocityTransactionAttempt = {
      transactionTrace: velocity.transactionTrace,
      transactionId: velocity.transactionId ?? null,
      transactionSessionId: velocity.transactionSessionId ?? null,
      initiatedAt: velocity.initiatedAt ?? new Date().toISOString(),
      source: "active_legacy",
    }
    const transactionAttempts = mergeVelocityAttempts(
      velocity.transactionAttempts,
      [currentAttempt, newAttempt],
    )
    const shouldActivate = Boolean(
      recovery.transactionTrace && ["pending", "awaiting_verification", "expired"].includes(current.status ?? ""),
    )
    const transactionTrace = shouldActivate ? recovery.transactionTrace : velocity.transactionTrace
    const redirectUrl = recovery.redirectUrl ?? velocity.redirectUrl ?? null
    const nextVelocity: VelocityOrderMetadata = {
      ...velocity,
      redirectUrl,
      transactionTrace,
      transactionId: shouldActivate
        ? recovery.transactionId
        : velocity.transactionId ?? null,
      transactionSessionId: shouldActivate
        ? recoverySessionId
        : velocity.transactionSessionId ?? null,
      transactionTraces: Array.from(new Set([
        ...(velocity.transactionTraces ?? []),
        ...transactionAttempts.map((attempt) => attempt.transactionTrace),
      ].filter((trace): trace is string => Boolean(trace)))),
      transactionAttempts,
      redirectRecoveryAttempted: recovery.attempted,
      redirectRecoveryInProgressAt: null,
      redirectRecoveryToken: null,
      ...(shouldActivate
        ? { pollStatus: "PENDING" as const, paymentStatus: "PENDING", failedAt: null, failureReason: null }
        : {}),
    }
    await tx
      .update(orders)
      .set({ metadata: { ...metadata, velocity: nextVelocity }, updatedAt: new Date() })
      .where(eq(orders.id, orderId))
    return { redirectUrl, transactionTrace, inProgress: false, recoverable: true }
  })
}

// Maximum retry attempts for Velocity card transactions that fail to return
// a hosted checkout redirect URL. Each retry re-initiates a new transaction.
const VMC_REDIRECT_RETRIES = 0

const Body = CheckoutBody

export async function POST(req: Request) {
  const rl = await checkoutSubmitLimiter.checkRequest(req)
  if (!rl.allowed) {
    return checkoutJson({ error: "Too many requests" }, {
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
    return checkoutJson(
      { error: "Invalid request — " + (detail ?? "check your details and try again") },
      { status: 400 },
    )
  }

  // A recorded attempt remains recoverable after stock sells out or sales end.
  if (!parsed.quoteOnly) {
    const [recorded] = await db.select().from(orders).where(sql`${orders.metadata}->>'checkoutRequestId' = ${parsed.checkoutRequestId}`).limit(1)
    if (recorded) return resumeOrder(recorded, parsed, { id: recorded.eventId }, makeCheckoutFingerprint(parsed, recorded.eventId, Number(recorded.totalAmount), recorded.currency ?? 'USD'), recorded.currency ?? 'USD')
  }

  const [event] = await db.select().from(events).where(eq(events.slug, parsed.eventSlug)).limit(1)
  if (!event) return checkoutJson({ error: "Event not found" }, { status: 404 })

  const now = new Date()
  const eventEndedAt = event.endsAt ?? event.startsAt
  if (eventEndedAt && new Date(eventEndedAt) < now) {
    return checkoutJson({ error: "Ticket sales for this event have ended" }, { status: 400 })
  }

  if (event.status !== "published") {
    return checkoutJson({ error: "This event is not currently available for purchase" }, { status: 400 })
  }

  const lineKeys = parsed.items.map(i => i.kind === "ticket" ? "ticket:" + i.tierId : i.kind === "merch" ? "merch:" + i.itemId + ":" + (i.size ?? "") : "addon:" + i.listingId)
  if (new Set(lineKeys).size !== lineKeys.length) return checkoutJson({ error: "Combine duplicate cart lines before checkout." }, { status: 400 })
  const ticketItems = parsed.items.filter((i): i is typeof i & { kind: "ticket" } => i.kind === "ticket")
  const vendorAddonItems = parsed.items.filter((i): i is typeof i & { kind: "vendor_addon" } => i.kind === "vendor_addon")
  const merchOrderItems = parsed.items.filter((i): i is typeof i & { kind: "merch" } => i.kind === "merch")

  // Velocity sales orders need at least one ticket item to compute a valid unit price.
  if (ticketItems.length === 0) {
    return checkoutJson({ error: "At least one ticket is required" }, { status: 400 })
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
      return checkoutJson({ error: `Tier ${item.tierId} not in event` }, { status: 400 })
    }
    if (tier.salesStart && new Date(tier.salesStart) > now) {
      return checkoutJson({ error: `"${tier.name}" is not yet available for purchase` }, { status: 400 })
    }
    if (tier.salesEnd && new Date(tier.salesEnd) < now) {
      return checkoutJson({ error: `Sales for "${tier.name}" have ended` }, { status: 400 })
    }
    if (Number(tier.soldQuantity ?? 0) >= Number(tier.totalQuantity ?? 0)) {
      return checkoutJson({ error: `"${tier.name}" is sold out` }, { status: 400 })
    }
    if (Number(tier.totalQuantity ?? 0) - Number(tier.soldQuantity ?? 0) < item.quantity) {
      return checkoutJson({ error: `Only ${Number(tier.totalQuantity ?? 0) - Number(tier.soldQuantity ?? 0)} ticket(s) left for "${tier.name}"` }, { status: 400 })
    }
    if (tier.maxPerOrder && item.quantity > tier.maxPerOrder) {
      return checkoutJson({ error: `Maximum ${tier.maxPerOrder} ticket(s) per order for "${tier.name}"` }, { status: 400 })
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
      return checkoutJson({ error: `Vendor addon ${item.listingId} not found` }, { status: 400 })
    }
  }

  const merchById = new Map(merchRows.map((item) => [item.id, item]))
  for (const item of merchOrderItems) {
    const merch = merchById.get(item.itemId)
    if (!merch) return checkoutJson({ error: "Merch item is no longer available" }, { status: 400 })
    if (item.size && !(merch.sizes ?? []).includes(item.size)) {
      return checkoutJson({ error: `Size ${item.size} is not available for ${merch.name}` }, { status: 400 })
    }
    const available = Number(merch.stockQuantity ?? 0) - Number(merch.soldQuantity ?? 0)
    if (available < item.quantity) {
      return checkoutJson({ error: `Only ${Math.max(0, available)} ${merch.name} item(s) left` }, { status: 400 })
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
    return checkoutJson({ error: "Mixed-currency cart not supported yet" }, { status: 400 })
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

  const subtotal = Math.round(total * 100) / 100
  const gatewayFee = calculateGatewayFee(subtotal)
  total = Math.round((subtotal + gatewayFee) * 100) / 100
  // Amount sent to Velocity: ticket price + our 0.5% markup. Velocity adds its
  // own 2.5% fee on top, so the buyer still pays ~3% (the displayed total).
  const gatewayCharge = calculateGatewayCharge(subtotal)
  if (gatewayCharge > 0 && !parsed.quoteOnly) {
    const validationError = validateTransactionPayload({ amount: gatewayCharge, processor: parsed.paymentMethod === "velocity-ecocash" ? "ECOCASH" : "VMC", phone: formatPhone(parsed.phone), currency })
    if (validationError) return checkoutJson({ error: validationError }, { status: 400 })
  }
  let questionResponseMeta: Record<string, string> | undefined
  const eventQuestionsList = await db
    .select({ id: ticketQuestions.id, question: ticketQuestions.question, required: ticketQuestions.required })
    .from(ticketQuestions)
    .where(eq(ticketQuestions.eventId, event.id))
  const quote = { amount: total, subtotal, gatewayFee, gatewayFeePercent: GATEWAY_FEE_PERCENT, currency, normalizedPhone: formatPhone(parsed.phone), questions: eventQuestionsList,
    lines: ticketItems.map(i => ({ tierId: i.tierId, quantity: i.quantity, unitPrice: effectivePrice(tierById.get(i.tierId)!, i.quantity) })) }
  if (parsed.quoteOnly) return checkoutJson({ success: true, quote })
  if (!quoteMatches(parsed, total, currency)) return checkoutJson({ error: "Your total has changed. Review the updated amount and confirm again.", code: "price_changed", quote }, { status: 409 })
  const questionResponses = parsed.questionResponses ?? {}
  const questionMap = new Map(eventQuestionsList.map((q) => [q.id, q]))
  for (const [qid, answer] of Object.entries(questionResponses)) {
    const q = questionMap.get(qid)
    if (!q) return checkoutJson({ error: `Invalid question ID: ${qid}` }, { status: 400 })
    if (q.required && !answer.trim()) {
      return checkoutJson({ error: "Required question missing answer" }, { status: 400 })
    }
  }
  for (const q of eventQuestionsList) {
    if (q.required && !questionResponses[q.id]?.trim()) {
      return checkoutJson({ error: "Required question missing answer" }, { status: 400 })
    }
  }
  if (Object.keys(questionResponses).length > 0) questionResponseMeta = questionResponses

  const baseMeta = {
    buyerFees: { itemSubtotal: subtotal, gatewayFee, gatewayFeePercent: GATEWAY_FEE_PERCENT, gatewayAmount: gatewayCharge, markupPercent: GATEWAY_MARKUP_PERCENT },
    ...(questionResponseMeta ? { questionResponses: questionResponseMeta } : {}),
    ...(merchOrderItems.length > 0
      ? { merchSelections: merchOrderItems.map((item) => ({ itemId: item.itemId, size: item.size ?? null })) }
      : {}),
    // Phase 2 rewrites order metadata from baseMeta, so the reservation flag
    // must live here — otherwise it's wiped after order creation, delivery
    // double-increments soldQuantity, and expiry never releases the seats.
    inventoryReserved: true,
  }

  // A resumable payment must represent the same checkout attempt. Matching
  // only by event and email can resume an order created with a different
  // payment method, phone number, amount, or cart after a customer corrects a
  // typo and retries.
  const checkoutFingerprint = makeCheckoutFingerprint(parsed, event.id, total, currency)

  // ── Idempotency: resume an existing in-progress order if one exists ──────────
  // Handles retries, double-clicks, and page-refresh re-submissions without
  // creating duplicate orders or surfacing a confusing error to the user.
  // An order is only resumable when it is the same payment attempt: same method,
  // amount and currency, and — for EcoCash — the same debit phone. Otherwise a
  // buyer who corrects a mistyped number would be handed the old transaction and
  // never receive a new USSD prompt on the right phone.
  async function findResumableOrder(tx?: DbTx) {
    const [existing] = await (tx ?? db).select({ id: orders.id, eventId: orders.eventId, guestEmail: orders.guestEmail,
      status: orders.status, paymentMethod: orders.paymentMethod, totalAmount: orders.totalAmount, currency: orders.currency,
      guestPhone: orders.guestPhone, metadata: orders.metadata }).from(orders)
      .where(sql`(${orders.metadata}->>'checkoutRequestId' = ${parsed.checkoutRequestId} OR (${orders.metadata}->>'checkoutFingerprint' = ${checkoutFingerprint} AND ${orders.status} IN ('pending', 'awaiting_verification')))` ).orderBy(desc(orders.createdAt)).limit(1)
    return existing ?? null
  }

  const resumable = await findResumableOrder()
  if (resumable) return resumeOrder(resumable, parsed, event, checkoutFingerprint, currency)

  // ── Phase 1: Create order atomically under lock ────────────────────────────
  // withLock uses pg_try_advisory_xact_lock (transaction-scoped) — the lock
  // auto-releases on commit. DB writes are atomic; HTTP calls happen after.
  const lockKey = `velocity-checkout:event:${event.id}`

  let creation: { orderId: string; existing?: boolean } | null
  try {
    creation = await withLock(lockKey, async (tx) => {
      const existing = await findResumableOrder(tx)
      if (existing) return { orderId: existing.id, existing: true }
      // Lock stock and recheck the reviewed unit prices before creating the order.
      const currentTiers = await tx.select().from(ticketTiers).where(inArray(ticketTiers.id, ticketItems.map(i => i.tierId))).orderBy(ticketTiers.id).for('update')
      for (const current of currentTiers) {
        const item = ticketItems.find(i => i.tierId === current.id)!
        const previous = tierById.get(current.id)!
        if (current.currency !== previous.currency || effectivePrice(current, item.quantity) !== effectivePrice(previous, item.quantity)) throw new Error('Ticket pricing changed. Review your order again before paying.')
        tierById.set(current.id, { ...current, soldQuantity: current.soldQuantity ?? 0 })
      }
      if (merchOrderItems.length) {
        const currentMerch = await tx.select().from(merchItems).where(inArray(merchItems.id, merchOrderItems.map(i => i.itemId))).orderBy(merchItems.id).for('update')
        for (const current of currentMerch) {
          const previous = merchById.get(current.id)!
          if (current.price !== previous.price || current.currency !== previous.currency) throw new Error('Merchandise pricing changed. Review your order again before paying.')
        }
      }
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
          metadata: { ...baseMeta, checkoutFingerprint, checkoutRequestId: parsed.checkoutRequestId, inventoryReserved: true },
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
      // Conditional atomic increment, mirroring the merch branch below.
      // The WHERE clause is what enforces the cap: a plain `WHERE id = ?` with
      // a JS-computed absolute value would let concurrent writers (cron expiry,
      // admin refunds, recovery) clobber each other and oversell the tier.
      for (const item of ticketItems) {
        const tier = tierById.get(item.tierId)!
        const [reserved] = await tx
          .update(ticketTiers)
          .set({ soldQuantity: sql`COALESCE(${ticketTiers.soldQuantity}, 0) + ${item.quantity}` })
          .where(and(
            eq(ticketTiers.id, item.tierId),
            sql`COALESCE(${ticketTiers.soldQuantity}, 0) + ${item.quantity} <= ${ticketTiers.totalQuantity}`,
          ))
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

      return { orderId: order.id }
    })
  } catch (err) {
    // Reservation failed (tier sold out) or DB error — surface as 409
    const msg = err instanceof Error ? err.message : "Checkout failed"
    log.warn("velocity checkout - order creation failed", { error: msg, email: parsed.email, eventId: event.id })
    return checkoutJson({ error: msg }, { status: 409 })
  }

  if (!creation) {
    // Lock contention: a concurrent request is creating an order at this exact
    // moment. Wait briefly for it to commit, then try to resume that order.
    await new Promise((r) => setTimeout(r, 400))
    const concurrent = await findResumableOrder()
    if (concurrent) return resumeOrder(concurrent, parsed, event, checkoutFingerprint, currency)
    return checkoutJson(
      { error: "Your checkout is being processed. Please wait a moment and try again." },
      { status: 429 },
    )
  }

  if (creation.existing) {
    const existing = await findResumableOrder()
    if (existing) return resumeOrder(existing, parsed, event, checkoutFingerprint, currency)
    return checkoutJson({ error: "Your checkout is being recovered. Please retry shortly." }, { status: 409 })
  }
  const { orderId } = creation

  // Cancels the order AND releases the inventory reservation so seats aren't
  // locked forever. Called on any Phase 2 failure (validation, config, API error).
  const cancelWithInventoryRelease = async () => {
    await cancelUnpaidOrderAndReleaseInventory(orderId)
  }
  let initiationStage = "sales_order"

  const sessionId = req.headers.get("x-session-id") ?? crypto.randomUUID()

  // Pre-payment funnel stages are recorded when the buyer actually reaches them.

  // ── Zero-amount order (free tickets) — skip Velocity, mark paid directly ────
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

    return checkoutJson({
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
          unitPrice: gatewayCharge / ticketQty,
          amount: gatewayCharge,
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
      amount: gatewayCharge,
      processor,
      phone: formattedPhone,
      currency,
    })
    if (validationError) {
      await cancelWithInventoryRelease()
      return checkoutJson({ error: validationError }, { status: 400 })
    }

    if (!config.merchantPhone) {
      await cancelWithInventoryRelease()
      return checkoutJson({ error: "Merchant phone not configured" }, { status: 500 })
    }

    // ── Persist the sales-order trace before the risky call ──────────────────
    // initiateTransaction() is where Velocity actually dispatches the EcoCash
    // USSD prompt — if our HTTP request to it times out (15s) but the prompt
    // was already sent, the buyer can still approve and pay while we think the
    // request failed. Writing salesOrderTrace now, before that call, means the
    // Velocity webhook callback (which looks orders up by salesOrderTrace, see
    // app/api/payments/velocity/callback/route.ts) can still find and settle
    // this order later even if initiateTransaction throws below.
    await db.transaction(async (tx) => {
      await lockOrderMutation(tx, orderId)
      const [current] = await tx.select({ metadata: orders.metadata }).from(orders).where(eq(orders.id, orderId)).limit(1)
      const currentMetadata = (current?.metadata ?? {}) as Record<string, unknown>
      await tx
        .update(orders)
        .set({
          metadata: {
            ...currentMetadata,
            ...baseMeta,
            velocity: {
              salesOrderTrace,
              salesOrderId,
              transactionTrace: null,
              outstandingAmount: gatewayCharge,
              paymentProcessor: processor,
              pollStatus: "UNKNOWN" as VelocityPollStatus,
              paymentStatus: null,
              paymentRef: null,
              invoiceRef: null,
              initiatedAt: new Date().toISOString(),
              finalizedAt: null,
            },
          },
          updatedAt: new Date(),
        })
        .where(eq(orders.id, orderId))
    })

    const isCard = processor === "VMC"

    const returnUrlFields: Record<string, string | undefined> = {}
    if (isCard) {
      const base = `${getBaseUrl()}/api/checkout/velocity`
      returnUrlFields.returnUrl = `${base}/return/${orderId}?sig=${signTicketPayload(orderId, orderId)}`
      returnUrlFields.successUrl = `${base}/return/${orderId}?sig=${signTicketPayload(orderId, orderId)}`
      returnUrlFields.cancelUrl = `${generateOrderAccessUrl(orderId, getBaseUrl())}&error=cancelled`
    }

    // For card (VMC) payments, use the merchant phone as a fallback if the
    // buyer's phone is empty or invalid — Velocity still requires a debitPhone
    // value, but it's not used for a USSD prompt.
    const effectivePhone = formattedPhone || config.merchantPhone || "+263000000000"

    const transactionPayload = {
      amount: gatewayCharge,
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

    log.info("velocity checkout - initiating transaction", { orderId, salesOrderId, processor, amount: gatewayCharge, authType })

    // For VMC (card) payments, retry the transaction initiation up to
    // VMC_REDIRECT_RETRIES times if Velocity returns no hosted checkout URL.
    // Velocity's card gateway is known to intermittently omit the redirect,
    // so a fresh transaction against the same sales order usually succeeds.
    initiationStage = "initiate_transaction"
    const transaction = await initiateTransaction(transactionPayload)
    initiationStage = "persist_transaction_response"
    let redirectUrl = extractRedirectUrl(transaction as unknown as Record<string, unknown>)
    const transactionBody = transaction.body ?? null
    const transactionTrace = getVelocityTransactionTrace(transaction)
    const transactionTraces = transactionTrace ? [transactionTrace] : []
    const transactionAttempts = mergeVelocityAttempts([
      velocityAttempt(transaction, redirectUrl, "checkout_initial"),
    ])

    if (isCard && !redirectUrl) {
      const sessionId = (transactionBody as Record<string, unknown> | null)?.sessionId
      if (typeof sessionId === 'string') {
        try { redirectUrl = (await getTransactionRedirectUrl(sessionId)) ?? undefined }
        catch (error) { log.warn('Hosted payment link lookup delayed', { orderId, error: String(error) }) }
      }
    }

    const activeAttempt = [...transactionAttempts].reverse().find((attempt) =>
      transactionTrace
        ? attempt.transactionTrace === transactionTrace
        : attempt.transactionTrace === null,
    )
    const activeTransactionId = activeAttempt?.transactionId ?? transactionBody?.id ?? null
    const suppliedSession = (transactionBody as Record<string, unknown> | null)?.sessionId
    const activeTransactionSessionId = activeAttempt?.transactionSessionId ?? extractHostedSessionId(redirectUrl ?? null) ?? (typeof suppliedSession === "string" ? suppliedSession : null)
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
      await db.transaction(async (tx) => {
        await lockOrderMutation(tx, orderId)
        const [current] = await tx.select({ metadata: orders.metadata }).from(orders).where(eq(orders.id, orderId)).limit(1)
        const currentMetadata = (current?.metadata ?? {}) as Record<string, unknown>
        await tx
          .update(orders)
          .set({
            metadata: {
              ...currentMetadata,
              ...baseMeta,
              velocity: {
              salesOrderTrace,
              salesOrderId,
              transactionTrace: null,
              transactionId: activeTransactionId,
              transactionSessionId: activeTransactionSessionId,
              transactionAttempts,
              outstandingAmount: gatewayCharge,
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
      })

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
        ? "The card payment service did not return a transaction reference. Confirmation is unresolved. Please do not pay again; view your order or contact support."
        : "Confirmation is unresolved. Please do not pay again; view your order or contact support."
      return checkoutJson({
        error: userMsg, orderId, recoverable: true,
      }, { status: 502 })
    }

    const velocityMeta: VelocityOrderMetadata = {
      salesOrderTrace,
      salesOrderId,
      transactionTrace,
      transactionId: activeTransactionId,
      transactionSessionId: activeTransactionSessionId,
      transactionTraces,
      transactionAttempts,
      redirectRecoveryAttempted: false,
      outstandingAmount: gatewayCharge,
      paymentProcessor: processor,
      pollStatus,
      paymentStatus: transactionBody?.paymentStatus ?? null,
      paymentRef: null,
      invoiceRef: null,
      initiatedAt: new Date().toISOString(),
      finalizedAt: null,
      redirectUrl: redirectUrl ?? null,
    }

    await db.transaction(async (tx) => {
      await lockOrderMutation(tx, orderId)
      const [current] = await tx.select({ metadata: orders.metadata }).from(orders).where(eq(orders.id, orderId)).limit(1)
      const currentMetadata = (current?.metadata ?? {}) as Record<string, unknown> & { velocity?: VelocityOrderMetadata }
      const previousVelocity = currentMetadata.velocity
      const mergedVelocity: VelocityOrderMetadata = {
        ...velocityMeta,
        transactionTraces: Array.from(new Set([
          ...(previousVelocity?.transactionTraces ?? []),
          ...transactionTraces,
        ])),
        transactionAttempts: mergeVelocityAttempts(previousVelocity?.transactionAttempts, transactionAttempts),
      }
      await tx
        .update(orders)
        .set({ metadata: { ...currentMetadata, ...baseMeta, velocity: mergedVelocity }, updatedAt: new Date() })
        .where(eq(orders.id, orderId))
    })

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

      return checkoutJson({
        error: "The card payment provider did not return a checkout page. Your order is being held for reconciliation; try again shortly or choose EcoCash.",
        orderId,
        recoverable: true,
      }, { status: 502 })
    }

    return checkoutJson({
      success: true,
      paymentMethod: isCard ? "CARD" : "ECOCASH",
      orderId,
      salesOrderTrace,
      transactionTrace,
      flow: isCard ? "velocity-redirect" : "velocity-seamless",
      pollRequired: true,
      redirectUrl: redirectUrl ?? null,
      amount: total,
      currency,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Checkout failed"
    log.error("velocity checkout failed", { orderId, error: message })

    // A network/timeout error talking to Velocity is ambiguous — the request
    // (createSalesOrder or initiateTransaction) may have actually gone through
    // on Velocity's side even though our client gave up waiting for a
    // response. This is exactly how a real EcoCash charge can succeed while
    // our order still gets cancelled. Only cancel + release inventory on a
    // *definitive* rejection from Velocity (a real error response). Ambiguous
    // cases are left "pending" — the salesOrderTrace persisted above lets the
    // webhook callback (app/api/payments/velocity/callback/route.ts) or the
    // recheck-velocity cron reconcile the order once Velocity's real status
    // is known, instead of orphaning it.
    const isAmbiguous = !isDefinitiveRejection(err)
    await db.update(orders).set({
      metadata: sql`jsonb_set(COALESCE(${orders.metadata}, '{}'::jsonb), '{initiationError}', ${JSON.stringify({ stage: initiationStage, ambiguous: isAmbiguous, httpStatus: err instanceof VelocityApiError ? err.httpStatus : null, occurredAt: new Date().toISOString(), message: message.slice(0, 300) })}::jsonb)`,
      updatedAt: new Date(),
    }).where(and(eq(orders.id, orderId), inArray(orders.status, ["pending", "awaiting_verification"]))).catch((error) => log.error("checkout - failed to persist initiation diagnostic", { orderId, error: String(error) }))

    alertPaymentAnomaly({
      type: "TRANSACTION_API_ERROR",
      severity: isAmbiguous ? "high" : "medium",
      title: isAmbiguous
        ? "Velocity request timed out — order left pending for reconciliation"
        : "Velocity API error during checkout",
      detail: isAmbiguous
        ? `Checkout for order ${orderId} (${parsed.paymentMethod}) hit an ambiguous network/timeout error: ${message.slice(0, 300)}. Order left pending — the buyer may still complete payment.`
        : `Checkout for order ${orderId} (${parsed.paymentMethod}) hit a Velocity API error: ${message.slice(0, 300)}. The buyer was shown an error and can retry.`,
      orderId,
      paymentMethod: parsed.paymentMethod,
      context: { errorMessage: message.slice(0, 500), isAmbiguous },
    }).catch(() => {})

    if (!isAmbiguous) {
      await cancelWithInventoryRelease()
    }
    if (isAmbiguous && parsed.paymentMethod === "velocity-ecocash") {
      return checkoutJson({ success: true, orderId, paymentMethod: "ECOCASH", flow: "velocity-seamless", pollRequired: true, awaitingConfirmation: true, amount: total, currency,
        message: "Payment confirmation is delayed. Please do not pay again; we are checking your order." })
    }
    return checkoutJson({ error: "Payment could not be confirmed. View your order before paying again.", orderId, recoverable: isAmbiguous }, { status: 502 })
  }
}

function checkoutJson(payload: unknown, init?: ResponseInit) {
  const body = payload as Record<string, unknown>
  if (typeof body.orderId === "string") return NextResponse.json({ ...body, accessSignature: signTicketPayload(body.orderId, body.orderId) }, init)
  return NextResponse.json(payload, init)
}

  async function resumeOrder(resumable: Pick<typeof orders.$inferSelect, 'id' | 'eventId' | 'guestEmail' | 'status' | 'paymentMethod' | 'totalAmount' | 'currency' | 'metadata'>, parsed: z.infer<typeof Body>, event: { id: string }, checkoutFingerprint: string, currency: string) {
    const storedFingerprint = (resumable.metadata as Record<string, unknown> | null)?.checkoutFingerprint
    if (resumable.eventId !== event.id || resumable.guestEmail !== parsed.email) return checkoutJson({ error: "Checkout identity does not match." }, { status: 403 })
    if (storedFingerprint !== checkoutFingerprint) {
      return checkoutJson({ error: "An earlier checkout is still recorded. Check its status before starting another payment.", orderId: resumable.id, recoverable: true }, { status: 409 })
    }
    if (["paid", "completed"].includes(resumable.status ?? "")) return checkoutJson({ success: true, orderId: resumable.id,
      flow: "free", paymentMethod: "FREE", amount: Number(resumable.totalAmount), currency: resumable.currency, resumed: true })
    if (!["pending", "awaiting_verification"].includes(resumable.status ?? "")) return checkoutJson({ error: "This checkout is closed. View your order before starting a new purchase.", orderId: resumable.id }, { status: 410 })
    const meta = (resumable.metadata ?? {}) as { velocity?: VelocityOrderMetadata }
    const vm = meta.velocity
    if (!vm) {
      return checkoutJson(
        { error: "Your payment is still being initialized. View your order; please do not pay again.", orderId: resumable.id, recoverable: true },
        { status: 409 },
      )
    }
    const isCard = resumable.paymentMethod === "velocity-card"
    log.info("velocity checkout - resuming existing order", { orderId: resumable.id, email: parsed.email })

    // For card payments, attempt to recover the redirect URL so the buyer
    // actually gets sent to Velocity's hosted checkout instead of being
    // stuck in a polling loop for a payment they can't complete.
    let resumeRedirectUrl: string | null = vm.redirectUrl ?? null
    let resolvedTransactionTrace = vm.transactionTrace
    if (isCard) {
      const recovery = await recoverAndPersistCardRedirect(resumable.id, currency as "USD" | "ZWG")
      if (!recovery.recoverable) {
        return checkoutJson({ error: "This payment requires reconciliation." }, { status: 409 })
      }
      if (recovery.inProgress) {
        return checkoutJson(
          { error: "Your card checkout is being recovered. Please wait a moment and try again." },
          { status: 409 },
        )
      }
      resumeRedirectUrl = recovery.redirectUrl
      resolvedTransactionTrace = recovery.transactionTrace ?? vm.transactionTrace
    }

    return checkoutJson({
      success: true,
      paymentMethod: isCard ? "CARD" : "ECOCASH",
      orderId: resumable.id,
      salesOrderTrace: vm.salesOrderTrace,
      transactionTrace: resolvedTransactionTrace,
      flow: isCard ? "velocity-redirect" : "velocity-seamless",
      pollRequired: true,
      redirectUrl: resumeRedirectUrl,
      amount: Number(resumable.totalAmount),
      currency: resumable.currency ?? currency,
      resumed: true,
    })
  }
