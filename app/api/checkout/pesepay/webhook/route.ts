import { NextResponse } from "next/server"
import { and, eq, sql } from "drizzle-orm"
import { db } from "@/db"
import { orders } from "@/db/schema"
import { getPesepay } from "@/lib/pesepay"
import { startOrderVerification } from "@/lib/order-verification"
import { log } from "@/lib/logger"

// PesePay calls this URL server-to-server once it has a definitive result for
// a transaction. The format varies (sometimes a JSON body with a payload,
// sometimes just the referenceNumber on the query string), so we accept both,
// then independently verify the status via the SDK before doing anything.
//
// Idempotency: the status-advance is wrapped in a database transaction so that
// two concurrent webhooks for the same order cannot both proceed. Only the
// first one to commit the update wins; the second finds the order already past
// `pending` and returns early.
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

  // ── Atomic idempotency gate ──────────────────────────────────────────────
  // Atomically: find the order AND move it out of "pending" so that concurrent
  // webhook deliveries race on this single UPDATE. The loser gets zero rows
  // back because the WHERE status = 'pending' clause no longer matches.
  try {
    const result = await db.transaction(async (tx) => {
      // Claim the order — only succeeds if still pending
      const [claimed] = await tx
        .update(orders)
        .set({
          status: "verifying",
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(orders.paymentRef, reference),
            eq(orders.status, "pending"),
          ),
        )
        .returning()

      if (!claimed) {
        // Order either doesn't exist or was already claimed — fetch its
        // current status so we can log it and return a sensible response.
        const [existing] = await tx
          .select({ id: orders.id, status: orders.status })
          .from(orders)
          .where(eq(orders.paymentRef, reference))
          .limit(1)

        if (!existing) {
          return { ok: false, status: 404, body: { error: "order_not_found" } }
        }

        return { ok: true, status: 200, body: { ok: true, status: existing.status } }
      }

      return { ok: true, claimed, status: 200, body: null }
    })

    // Early return for duplicate / already-processed webhooks
    if (!result.claimed) {
      return NextResponse.json(result.body, { status: result.status })
    }

    // ── Independent verification via PesePay SDK ───────────────────────────
    const pesepay = getPesepay()
    const check = await pesepay.checkPayment(reference)

    if (!check.success) {
      log.warn("pesepay webhook — check failed", { reference, message: check.message })
      // Revert status so the order can be re-processed later
      await db
        .update(orders)
        .set({ status: "pending", updatedAt: new Date() })
        .where(eq(orders.id, result.claimed.id))
      return NextResponse.json({ ok: false, message: check.message }, { status: 200 })
    }

    if (!check.paid) {
      log.info("pesepay webhook — not yet paid", { reference, status: check.status })
      // Revert — the webhook may arrive again once payment clears
      await db
        .update(orders)
        .set({ status: "pending", updatedAt: new Date() })
        .where(eq(orders.id, result.claimed.id))
      return NextResponse.json({ ok: true, status: "pending" })
    }

    // ── Payment confirmed — start verification flow ────────────────────────
    const [order] = await db
      .select({ guestEmail: orders.guestEmail })
      .from(orders)
      .where(eq(orders.id, result.claimed.id))
      .limit(1)

    if (!order?.guestEmail) {
      log.error("pesepay webhook — order missing guestEmail", { orderId: result.claimed.id })
      return NextResponse.json({ error: "order_missing_email" }, { status: 500 })
    }

    const origin =
      process.env.PESEPAY_PUBLIC_URL?.replace(/\/$/, "") || url.origin

    await startOrderVerification({
      orderId: result.claimed.id,
      email: order.guestEmail,
      origin,
    })

    log.info("pesepay webhook — verification started", {
      reference,
      orderId: result.claimed.id,
    })

    return NextResponse.json({ ok: true, status: "awaiting_verification" })
  } catch (err) {
    log.error("pesepay webhook — unexpected error", {
      reference,
      error: err instanceof Error ? err.message : String(err),
    })
    return NextResponse.json({ error: "internal_error" }, { status: 500 })
  }
}
