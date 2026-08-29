import "server-only"

import { and, eq, inArray, sql } from "drizzle-orm"

import { db } from "@/db"
import { orders, paymentLedger } from "@/db/schema"
import { trackEvent } from "@/lib/analytics"
import { log } from "@/lib/logger"
import { restoreExpiredOrderInventory } from "@/lib/order-expiry"
import { alertPaymentAnomaly } from "@/lib/payment-alerts"
import { lockOrderMutation } from "@/lib/velocity/idempotency"
import { paymentAmountsMatch } from "@/lib/velocity/validation"
import {
  finalizeWorkflow,
  normalizeVelocityPollResponse,
  pollTransaction,
} from "@/services/velocity"
import type {
  LocalPaymentStatus,
  PollTransactionResponse,
  VelocityOrderMetadata,
  VelocityPollStatus,
} from "@/types/velocity"

const SETTLED_LEDGER_STATUSES = ["paid", "completed", "success", "paid_success"]
const SETTLEABLE_ORDER_STATUSES = ["pending", "awaiting_verification", "expired"]

/**
 * After this many consecutive Velocity provider errors (4xx/5xx on poll),
 * stop auto-retrying and flag the order for manual review instead. Without
 * this cap, recheck-velocity retries forever — some orders have accumulated
 * 1,000+ failed poll attempts over weeks with no path back to resolution.
 */
export const MAX_CONSECUTIVE_PROVIDER_ERRORS = 20

type OrderMetadata = Record<string, unknown> & {
  velocity?: VelocityOrderMetadata
  archive?: Record<string, unknown>
  promo?: { id?: string }
  inventoryReserved?: boolean
}

export type VelocityReconciliationState =
  | LocalPaymentStatus
  | "PROVIDER_ERROR"
  | "NETWORK_ERROR"
  | "UNPOLLABLE"
  | "INVALID"
  | "FINALIZE_PENDING"
  | "FINALIZE_ERROR"
  | "AMOUNT_MISMATCH"
  | "CONFLICT"

export type VelocityReconciliationResult = {
  orderId: string
  state: VelocityReconciliationState
  paid: boolean
  newlySettled: boolean
  orderStatus: string | null
  transactionTrace: string | null
  salesOrderTrace: string | null
  invoiceId: string | null
  pollResult: PollTransactionResponse | null
  providerHttpStatus: number | null
  message: string | null
  /** True when this order just crossed into needing manual review (see MAX_CONSECUTIVE_PROVIDER_ERRORS / UNPOLLABLE). */
  manualReviewRequired?: boolean
}

export type ReconcileVelocityOrderOptions = {
  orderId: string
  source: string
  actorEmail?: string | null
  rawPayload?: Record<string, unknown> | null
  transactionTrace?: string | null
}

type BuildObservedVelocityMetadataOptions = {
  preserveActiveReference?: boolean
  /** Set when the poll used a fallback trace-as-id and Velocity 400'd it — this reference will never resolve on its own. */
  unpollable?: boolean
}

function asMetadata(value: unknown): OrderMetadata {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as OrderMetadata
    : {}
}

export function buildObservedVelocityMetadata(
  current: VelocityOrderMetadata,
  pollResult: PollTransactionResponse,
  transactionTrace: string,
  observedAt: string,
  options: BuildObservedVelocityMetadataOptions = {},
): VelocityOrderMetadata {
  const normalized = normalizeVelocityPollResponse(pollResult)
  const providerError = typeof pollResult.httpStatus === "number" && pollResult.httpStatus >= 400
  const networkError = pollResult.state === "network_error"
  const providerFailure = providerError || networkError
  const transactionTraces = Array.from(new Set([
    ...(current.transactionTraces ?? []),
    current.transactionTrace,
    transactionTrace,
  ].filter((trace): trace is string => Boolean(trace))))
  const observation = {
    transactionTrace,
    transactionId: pollResult.body?.id || null,
    pollStatus: normalized.velocityPollStatus,
    paymentStatus: normalized.velocityPaymentStatus,
    state: pollResult.state,
    httpStatus: pollResult.httpStatus ?? null,
    errorMessage: pollResult.errorMessage ?? null,
    observedAt,
  }
  const transactionObservations = [
    ...(current.transactionObservations ?? []).filter(
      (entry) => entry.transactionTrace !== transactionTrace,
    ),
    observation,
  ].slice(-20)

  // A callback can arrive for an older attempt after the buyer has started a
  // replacement transaction. Record that observation without allowing an old
  // failure/pending result to replace the active trace or its status fields.
  if (options.preserveActiveReference) {
    return {
      ...current,
      transactionTraces,
      transactionObservations,
    }
  }

  const nextConsecutiveProviderErrors = providerFailure
    ? (current.consecutiveProviderErrors ?? 0) + 1
    : 0
  const crossedErrorCap = providerFailure && !options.unpollable && nextConsecutiveProviderErrors >= MAX_CONSECUTIVE_PROVIDER_ERRORS
  const manualReviewRequired = providerFailure
    ? Boolean(options.unpollable || crossedErrorCap || current.manualReviewRequired)
    : false
  const manualReviewReason = !manualReviewRequired
    ? null
    : options.unpollable
      ? "Velocity poll endpoint rejects this transaction reference (400) — no provider transactionId was ever issued, so this will not resolve automatically."
      : crossedErrorCap
        ? `Exceeded ${MAX_CONSECUTIVE_PROVIDER_ERRORS} consecutive Velocity provider errors — needs manual verification against the Velocity dashboard.`
        : (current.manualReviewReason ?? null)

  return {
    ...current,
    transactionTrace,
    transactionId: pollResult.body?.id || current.transactionId || null,
    transactionTraces,
    transactionObservations,
    pollStatus: (normalized.velocityPollStatus as VelocityPollStatus | null) ?? "UNKNOWN",
    paymentStatus: normalized.velocityPaymentStatus,
    lastPolledAt: observedAt,
    lastProviderHttpStatus: pollResult.httpStatus ?? null,
    lastProviderError: pollResult.errorMessage ?? null,
    consecutiveProviderErrors: nextConsecutiveProviderErrors,
    manualReviewRequired,
    manualReviewReason,
    ...(!networkError && !providerError && normalized.localStatus === "FAILED"
      ? {
          failedAt: observedAt,
          failureReason: `Velocity returned pollStatus: ${normalized.velocityPollStatus}, paymentStatus: ${normalized.velocityPaymentStatus}`,
          velocityRawPollResponse: {
            state: pollResult.state,
            status: pollResult.status,
            body: {
              id: pollResult.body?.id,
              trace: pollResult.body?.trace,
              amount: pollResult.body?.amount,
              paymentStatus: pollResult.body?.paymentStatus,
              pollStatus: pollResult.body?.pollStatus,
            },
          },
        }
      : !providerFailure
        ? { failedAt: null, failureReason: null }
        : {}),
  }
}

async function persistPollObservation(
  orderId: string,
  pollResult: PollTransactionResponse,
  transactionTrace: string,
  observedAt: string,
  unpollable = false,
): Promise<VelocityOrderMetadata> {
  return db.transaction(async (tx) => {
    await lockOrderMutation(tx, orderId)
    const [current] = await tx
      .select({ metadata: orders.metadata })
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1)
    const latest = asMetadata(current?.metadata).velocity
    if (!latest) throw new Error("Velocity metadata disappeared while recording poll observation")
    const normalized = normalizeVelocityPollResponse(pollResult)
    const preserveActiveReference = transactionTrace !== latest.transactionTrace && normalized.localStatus !== "PAID"
    const observed = buildObservedVelocityMetadata(
      latest,
      pollResult,
      transactionTrace,
      observedAt,
      { preserveActiveReference, unpollable },
    )
    await tx
      .update(orders)
      .set({
        metadata: sql`jsonb_set(COALESCE(${orders.metadata}, '{}'::jsonb), '{velocity}', ${JSON.stringify(observed)}::jsonb)`,
        updatedAt: new Date(),
      })
      .where(and(eq(orders.id, orderId), inArray(orders.status, ["pending", "awaiting_verification", "expired"])))
    return observed
  })
}

export async function reconcileVelocityOrder(
  options: ReconcileVelocityOrderOptions,
): Promise<VelocityReconciliationResult> {
  const [order] = await db.select().from(orders).where(eq(orders.id, options.orderId)).limit(1)
  if (!order) {
    return {
      orderId: options.orderId,
      state: "INVALID",
      paid: false,
      newlySettled: false,
      orderStatus: null,
      transactionTrace: null,
      salesOrderTrace: null,
      invoiceId: null,
      pollResult: null,
      providerHttpStatus: null,
      message: "Order not found",
    }
  }

  const metadata = asMetadata(order.metadata)
  const velocity = metadata.velocity
  const transactionTrace = options.transactionTrace ?? velocity?.transactionTrace ?? null
  const salesOrderTrace = velocity?.salesOrderTrace ?? null

  const baseResult = {
    orderId: order.id,
    paid: false,
    newlySettled: false,
    orderStatus: order.status,
    transactionTrace,
    salesOrderTrace,
    invoiceId: order.paymentRef ?? velocity?.invoiceRef ?? null,
    pollResult: null,
    providerHttpStatus: null,
  }

  if (!velocity || !transactionTrace || !salesOrderTrace) {
    return { ...baseResult, state: "INVALID", message: "Velocity transaction references are missing" }
  }

  const attempt = velocity.transactionAttempts?.find(
    (entry) => entry.transactionTrace === transactionTrace,
  )
  const isCurrentTrace = transactionTrace === velocity.transactionTrace
  const usedTransactionId = isCurrentTrace ? velocity.transactionId : attempt?.transactionId
  const pollResult = await pollTransaction(transactionTrace, {
    transactionId: usedTransactionId,
    transactionSessionId: isCurrentTrace ? velocity.transactionSessionId : attempt?.transactionSessionId,
  })
  const normalized = normalizeVelocityPollResponse(pollResult)
  const observedAt = new Date().toISOString()
  const providerError = typeof pollResult.httpStatus === "number" && pollResult.httpStatus >= 400
  // Velocity's poll endpoint wants its own provider-assigned transactionId;
  // when we never got one back from initiateTransaction, we fall back to
  // polling with the transactionTrace instead — Velocity rejects that with a
  // 400 every time. Nothing on our side can backfill a real transactionId
  // after the fact, so this reference will never resolve on its own.
  const isUnpollableReference = !usedTransactionId && pollResult.httpStatus === 400

  const observedVelocity = await persistPollObservation(
    order.id,
    pollResult,
    transactionTrace,
    observedAt,
    isUnpollableReference,
  )

  const polledResult = {
    ...baseResult,
    transactionTrace,
    pollResult,
    providerHttpStatus: pollResult.httpStatus ?? null,
    manualReviewRequired: observedVelocity.manualReviewRequired === true,
  }

  if (pollResult.state === "network_error") {
    return { ...polledResult, state: "NETWORK_ERROR", message: pollResult.errorMessage ?? "Velocity network error" }
  }
  if (isUnpollableReference) {
    return {
      ...polledResult,
      state: "UNPOLLABLE",
      message: observedVelocity.manualReviewReason ?? "Velocity poll endpoint rejects this transaction reference",
    }
  }
  if (providerError) {
    return { ...polledResult, state: "PROVIDER_ERROR", message: pollResult.errorMessage ?? "Velocity provider error" }
  }
  if (normalized.localStatus !== "PAID") {
    return {
      ...polledResult,
      state: normalized.localStatus,
      message: normalized.localStatus === "FAILED"
        ? "Velocity confirmed that the payment failed"
        : normalized.localStatus === "PENDING"
          ? "Velocity payment is still pending"
          : "Velocity payment status is inconclusive",
    }
  }

  let finalizeResult
  try {
    finalizeResult = await finalizeWorkflow(salesOrderTrace)
  } catch (error) {
    return {
      ...polledResult,
      state: "FINALIZE_ERROR",
      message: error instanceof Error ? error.message : String(error),
    }
  }

  if (finalizeResult.body.salesOrder.status !== "PAID") {
    return {
      ...polledResult,
      state: "FINALIZE_PENDING",
      message: `Velocity sales order is ${finalizeResult.body.salesOrder.status}, not PAID`,
    }
  }

  const paidAmount = finalizeResult.body.salesOrder.paidAmount
  if (!paymentAmountsMatch(order.totalAmount, paidAmount)) {
    alertPaymentAnomaly({
      type: "PAYMENT_AMOUNT_MISMATCH",
      severity: "critical",
      title: "Velocity payment amount does not match order",
      detail: `Order ${order.id} expected ${order.totalAmount} ${order.currency ?? "USD"}, but Velocity finalised ${paidAmount}.`,
      orderId: order.id,
      paymentMethod: order.paymentMethod ?? "velocity-card",
      context: { expectedAmount: order.totalAmount, paidAmount, transactionTrace, salesOrderTrace },
    }).catch(() => {})
    return { ...polledResult, state: "AMOUNT_MISMATCH", message: "Velocity paid amount does not match the order total" }
  }

  const invoiceId = finalizeResult.body.invoice.id
  const settledAt = new Date()

  try {
    const settlement = await db.transaction(async (tx) => {
      await lockOrderMutation(tx, order.id)

      const [current] = await tx.select().from(orders).where(eq(orders.id, order.id)).limit(1)
      if (!current) throw new Error("Order disappeared during Velocity settlement")
      if (!paymentAmountsMatch(current.totalAmount, paidAmount)) {
        throw new Error(`Order total changed during settlement (expected ${current.totalAmount}, Velocity paid ${paidAmount})`)
      }

      const currentMetadata = asMetadata(current.metadata)
      const currentVelocity = currentMetadata.velocity ?? velocity
      const [settledLedger] = await tx
        .select({ id: paymentLedger.id, transactionTrace: paymentLedger.transactionTrace })
        .from(paymentLedger)
        .where(and(
          eq(paymentLedger.orderId, order.id),
          inArray(paymentLedger.localStatus, SETTLED_LEDGER_STATUSES),
        ))
        .limit(1)

      if (settledLedger && settledLedger.transactionTrace !== transactionTrace) {
        throw new Error(`Order already has a settled ledger entry for a different transaction (${settledLedger.transactionTrace})`)
      }

      const [traceLedger] = await tx
        .select({ id: paymentLedger.id, orderId: paymentLedger.orderId })
        .from(paymentLedger)
        .where(eq(paymentLedger.transactionTrace, transactionTrace))
        .limit(1)

      if (traceLedger && traceLedger.orderId !== order.id) {
        throw new Error("Velocity transaction trace is already assigned to another order")
      }

      const alreadyPaid = current.status === "paid" || current.status === "completed"
      if (!alreadyPaid && !SETTLEABLE_ORDER_STATUSES.includes(current.status ?? "")) {
        throw new Error(`Order status ${current.status ?? "unknown"} cannot be settled automatically`)
      }

      if (current.status === "expired") {
        await restoreExpiredOrderInventory(tx, current, currentMetadata)
      }

      const finalVelocity: VelocityOrderMetadata = {
        ...currentVelocity,
        ...observedVelocity,
        transactionTrace,
        transactionId: pollResult.body?.id || currentVelocity.transactionId || null,
        transactionTraces: Array.from(new Set([
          ...(currentVelocity.transactionTraces ?? []),
          currentVelocity.transactionTrace,
          transactionTrace,
        ].filter((trace): trace is string => Boolean(trace)))),
        pollStatus: "SUCCESS",
        paymentStatus: normalized.velocityPaymentStatus ?? "SUCCESS",
        outstandingAmount: 0,
        paymentRef: invoiceId,
        invoiceRef: invoiceId,
        finalizedAt: settledAt.toISOString(),
        failedAt: null,
        failureReason: null,
        lastProviderError: null,
        consecutiveProviderErrors: 0,
        manualReviewRequired: false,
        manualReviewReason: null,
        ...(options.actorEmail ? { recheckedAt: settledAt.toISOString(), recheckedBy: options.actorEmail } : {}),
        ...(options.source === "callback" ? { callbackProcessedAt: settledAt.toISOString() } : {}),
      }
      const finalMetadata: OrderMetadata = {
        ...currentMetadata,
        velocity: finalVelocity,
        ...(current.status === "expired"
          ? {
              archive: {
                ...(currentMetadata.archive ?? {}),
                status: "recovered",
                reason: null,
                recoveredAt: settledAt.toISOString(),
                recoveredBy: options.source,
              },
            }
          : {}),
      }

      await tx
        .update(orders)
        .set({
          status: alreadyPaid ? current.status : "paid",
          paidAt: current.paidAt ?? settledAt,
          completedAt: current.completedAt ?? settledAt,
          paymentRef: invoiceId,
          metadata: finalMetadata,
          updatedAt: settledAt,
        })
        .where(eq(orders.id, order.id))

      const ledgerValues = {
        orderId: order.id,
        eventId: current.eventId,
        transactionTrace,
        salesOrderTrace,
        invoiceId,
        amount: current.totalAmount,
        currency: current.currency ?? "USD",
        processor: "velocity",
        velocityPollStatus: "SUCCESS",
        localStatus: "paid",
        source: options.source,
        rawPayload: options.rawPayload ?? pollResult,
        errorMessage: null,
      }

      if (traceLedger) {
        await tx.update(paymentLedger).set(ledgerValues).where(eq(paymentLedger.id, traceLedger.id))
      } else {
        await tx.insert(paymentLedger).values(ledgerValues)
      }

      return { newlySettled: !alreadyPaid, status: alreadyPaid ? current.status : "paid" }
    })

    if (settlement.newlySettled) {
      trackEvent({
        event: "PAYMENT_CONFIRMED",
        eventId: order.eventId,
        orderId: order.id,
        buyerEmail: order.guestEmail ?? undefined,
        paymentMethod: order.paymentMethod,
        amount: Number(order.totalAmount),
        metadata: { source: options.source, transactionTrace, salesOrderTrace, invoiceId },
      }).catch((error) => log.warn("velocity reconciliation - analytics failed", { orderId: order.id, error: String(error) }))
    }

    return {
      ...polledResult,
      state: "PAID",
      paid: true,
      newlySettled: settlement.newlySettled,
      orderStatus: settlement.status,
      invoiceId,
      message: settlement.newlySettled ? "Velocity payment settled locally" : "Velocity payment was already settled locally",
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    alertPaymentAnomaly({
      type: "VELOCITY_API_UNEXPECTED_FORMAT",
      severity: "critical",
      title: "Velocity settlement conflict",
      detail: `Order ${order.id} could not be settled atomically: ${message}`,
      orderId: order.id,
      paymentMethod: order.paymentMethod ?? "velocity-card",
      context: { transactionTrace, salesOrderTrace, invoiceId, source: options.source },
    }).catch(() => {})
    return { ...polledResult, state: "CONFLICT", invoiceId, message }
  }
}

/**
 * Reconcile every transaction attempt known for an order before releasing its
 * inventory. A definitive failure is returned only when every known trace has
 * failed; any paid or inconclusive attempt keeps the order open.
 */
export async function reconcileVelocityOrderBeforeExpiry(
  options: Omit<ReconcileVelocityOrderOptions, "transactionTrace">,
): Promise<VelocityReconciliationResult> {
  const [current] = await db
    .select({ metadata: orders.metadata })
    .from(orders)
    .where(eq(orders.id, options.orderId))
    .limit(1)
  const velocity = asMetadata(current?.metadata).velocity
  const knownTraces = Array.from(new Set([
    velocity?.transactionTrace,
    ...(velocity?.transactionAttempts ?? []).map((attempt) => attempt.transactionTrace),
    ...(velocity?.transactionTraces ?? []),
  ].filter((trace): trace is string => Boolean(trace))))
  const hasUnpollableAttempt = (velocity?.transactionAttempts ?? []).some(
    (attempt) => !attempt.transactionTrace && Boolean(attempt.transactionId || attempt.transactionSessionId),
  )

  if (knownTraces.length === 0) return reconcileVelocityOrder(options)

  let firstInconclusive: VelocityReconciliationResult | null = null
  let failedResult: VelocityReconciliationResult | null = null
  for (const transactionTrace of knownTraces) {
    const result = await reconcileVelocityOrder({ ...options, transactionTrace })
    if (result.paid) return result
    if (result.state === "FAILED") failedResult ??= result
    else firstInconclusive ??= result
  }

  if (firstInconclusive) return firstInconclusive
  if (hasUnpollableAttempt && failedResult) {
    return {
      ...failedResult,
      state: "INVALID",
      paid: false,
      newlySettled: false,
      message: "A provider transaction ID exists without a matching trace; manual reconciliation is required",
    }
  }
  return failedResult ?? reconcileVelocityOrder(options)
}
