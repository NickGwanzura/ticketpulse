import { NextResponse } from "next/server"
import { lte, and, eq, gt, inArray, sql } from "drizzle-orm"
import { db } from "@/db"
import { orders, orderItems, ticketTiers, tickets, paymentLedger, events } from "@/db/schema"
import { verifyCronSecret } from "@/lib/cron-auth"
import { log } from "@/lib/logger"
import { sendEmail } from "@/lib/email"
import { pollTransaction, normalizeVelocityPollResponse } from "@/services/velocity"
import type { VelocityOrderMetadata } from "@/types/velocity"

export async function POST(request: Request) {
  const authError = verifyCronSecret(request)
  if (authError) return authError
  const pendingCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const awaitingCutoff = new Date(Date.now() - 48 * 60 * 60 * 1000)

  const pendingStale = await db
    .select({ id: orders.id, status: orders.status, metadata: orders.metadata, eventId: orders.eventId, totalAmount: orders.totalAmount, currency: orders.currency, guestEmail: orders.guestEmail, guestName: orders.guestName, createdAt: orders.createdAt })
    .from(orders)
    .where(and(eq(orders.status, "pending"), lte(orders.createdAt, pendingCutoff)))
    .limit(50)

  const awaitingStale = await db
    .select({ id: orders.id, status: orders.status, metadata: orders.metadata, eventId: orders.eventId, totalAmount: orders.totalAmount, currency: orders.currency, guestEmail: orders.guestEmail, guestName: orders.guestName, createdAt: orders.createdAt })
    .from(orders)
    .where(and(eq(orders.status, "awaiting_verification"), lte(orders.createdAt, awaitingCutoff)))
    .limit(50)

  const staleOrders = [...pendingStale, ...awaitingStale]

  if (staleOrders.length === 0) {
    log.info("cron/expire-orders — no stale orders to expire")
    return NextResponse.json({ expired: 0 })
  }

  const ids = staleOrders.map((o) => o.id)

  const skippedVelocity: string[] = []

  for (const order of staleOrders) {
    const meta = (order.metadata ?? {}) as { velocity?: VelocityOrderMetadata }
    const velocityMeta = meta.velocity

    if (velocityMeta?.pollStatus === "SUCCESS" || velocityMeta?.paymentRef) {
      log.warn("cron/expire-orders — skipping order with confirmed Velocity payment", {
        orderId: order.id,
        status: order.status,
        pollStatus: velocityMeta.pollStatus,
        paymentRef: velocityMeta.paymentRef,
      })

      await db.insert(paymentLedger).values({
        orderId: order.id,
        eventId: order.eventId,
        transactionTrace: velocityMeta.transactionTrace ?? "",
        salesOrderTrace: velocityMeta.salesOrderTrace,
        amount: order.totalAmount,
        currency: order.currency ?? "USD",
        processor: "velocity",
        velocityPollStatus: velocityMeta.pollStatus ?? "UNKNOWN",
        localStatus: order.status ?? "unknown",
        source: "cron",
        rawPayload: null,
        errorMessage: "Cron attempted to expire but order has confirmed Velocity payment",
      })

      skippedVelocity.push(order.id)
      continue
    }

    // Live-poll any order with a Velocity transaction trace that hasn't been
    // confirmed yet. This acts as a last-resort safety net in case
    // recheck-velocity missed it. On poll failure we skip (safer than expiring
    // a potentially paid order).
    if (velocityMeta?.transactionTrace) {
      try {
        const pollResult = await pollTransaction(velocityMeta.transactionTrace)
        const normalized = normalizeVelocityPollResponse(pollResult)

        if (normalized.localStatus === "PAID") {
          log.warn("cron/expire-orders — live poll shows PAID, skipping expiry (recheck-velocity will finalize)", {
            orderId: order.id,
            transactionTrace: velocityMeta.transactionTrace,
            pollStatus: normalized.velocityPollStatus,
          })
          skippedVelocity.push(order.id)
          continue
        }

        log.info("cron/expire-orders — live poll confirmed not paid, proceeding with expiry", {
          orderId: order.id,
          localStatus: normalized.localStatus,
          pollStatus: normalized.velocityPollStatus,
        })
      } catch (pollErr) {
        log.warn("cron/expire-orders — live poll failed, skipping expiry to be safe", {
          orderId: order.id,
          transactionTrace: velocityMeta.transactionTrace,
          error: String(pollErr),
        })
        skippedVelocity.push(order.id)
        continue
      }
    }

    // Determine whether inventory was reserved for this order.
    // New orders (inventoryReserved=true): soldQuantity was incremented at checkout,
    //   so we always decrement using orderItems quantities.
    // Legacy orders: soldQuantity is only incremented at ticket delivery,
    //   so we only decrement if tickets were actually created.
    const orderMeta = (order.metadata ?? {}) as Record<string, unknown>
    const inventoryReserved = orderMeta.inventoryReserved === true

    let tierDecrement: Map<string, number> | null = null

    if (inventoryReserved) {
      const items = await db
        .select({ tierId: orderItems.tierId, quantity: orderItems.quantity })
        .from(orderItems)
        .where(eq(orderItems.orderId, order.id))
      tierDecrement = new Map()
      for (const item of items) {
        if (item.tierId) tierDecrement.set(item.tierId, (tierDecrement.get(item.tierId) ?? 0) + item.quantity)
      }
    } else {
      // Legacy: only decrement if tickets were physically created
      const orderTickets = await db
        .select({ tierId: tickets.tierId })
        .from(tickets)
        .where(eq(tickets.orderId, order.id))
      if (orderTickets.length > 0) {
        tierDecrement = new Map()
        for (const t of orderTickets) {
          if (t.tierId) tierDecrement.set(t.tierId, (tierDecrement.get(t.tierId) ?? 0) + 1)
        }
      }
    }

    if (tierDecrement && tierDecrement.size > 0) {
      await Promise.all(
        Array.from(tierDecrement).map(([tierId, qty]) =>
          db
            .update(ticketTiers)
            .set({ soldQuantity: sql`GREATEST(0, ${ticketTiers.soldQuantity} - ${qty})` })
            .where(eq(ticketTiers.id, tierId)),
        ),
      )
    }

    await db.insert(paymentLedger).values({
      orderId: order.id,
      eventId: order.eventId,
      transactionTrace: velocityMeta?.transactionTrace ?? "",
      salesOrderTrace: velocityMeta?.salesOrderTrace ?? "",
      amount: order.totalAmount,
      currency: order.currency ?? "USD",
      processor: "velocity",
      velocityPollStatus: velocityMeta?.pollStatus ?? "UNKNOWN",
      localStatus: "expired",
      source: "cron",
      errorMessage: "Order expired by cron",
    })
  }

  const expireIds = ids.filter((id) => !skippedVelocity.includes(id))

  if (expireIds.length > 0) {
    await db
      .update(orders)
      .set({ status: "expired", updatedAt: new Date() })
      .where(inArray(orders.id, expireIds))

    await db
      .update(tickets)
      .set({ status: "cancelled" })
      .where(inArray(tickets.orderId, expireIds))

    log.info(`cron/expire-orders — expired ${expireIds.length} orders, skipped ${skippedVelocity.length} with confirmed payments`, {
      expired: expireIds,
      skippedVelocity,
    })

    // ── Notify buyers whose orders were expired ─────────────────────────
    const expiredOrders = staleOrders.filter(
      (o) => expireIds.includes(o.id) && o.guestEmail,
    )
    if (expiredOrders.length > 0) {
      const notifyableExpiredOrders = []
      for (const order of expiredOrders) {
        const [replacement] = await db
          .select({ id: orders.id })
          .from(orders)
          .where(and(
            eq(orders.eventId, order.eventId),
            eq(orders.guestEmail, order.guestEmail!),
            inArray(orders.status, ["paid", "completed"]),
            gt(orders.createdAt, order.createdAt ?? new Date(0)),
          ))
          .limit(1)

        if (replacement) {
          log.info("cron/expire-orders — suppressing expiry email; buyer has a later paid order", {
            expiredOrderId: order.id,
            replacementOrderId: replacement.id,
            guestEmail: order.guestEmail,
            eventId: order.eventId,
          })
          continue
        }

        notifyableExpiredOrders.push(order)
      }

      if (notifyableExpiredOrders.length === 0) {
        return NextResponse.json({
          expired: expireIds.length,
          skipped: skippedVelocity.length,
          expiryEmailsSent: 0,
        })
      }

      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://ticketpulse.tech"
      const eventIds = [...new Set(notifyableExpiredOrders.map((o) => o.eventId))]
      const eventRows = await db
        .select({ id: events.id, title: events.title, slug: events.slug })
        .from(events)
        .where(inArray(events.id, eventIds))
      const eventMap = new Map(eventRows.map((e) => [e.id, e]))

      await Promise.allSettled(
        notifyableExpiredOrders.map((order) => {
          const ev = eventMap.get(order.eventId)
          const eventTitle = ev?.title ?? "your event"
          const eventUrl = ev?.slug ? `${appUrl}/events/${ev.slug}` : null
          const name = order.guestName ?? "there"
          const ref = order.id.slice(0, 8).toUpperCase()
          return sendEmail({
            to: order.guestEmail!,
            subject: `Your order has expired — ${eventTitle}`,
            html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1a1a1a">
<h2 style="font-size:20px;font-weight:700;margin-bottom:8px">Your order has expired</h2>
<p>Hi ${name},</p>
<p>Your order for <strong>${eventTitle}</strong> expired because we didn't receive payment confirmation in time.</p>
<p>If money was deducted from your account, please contact us with your order reference: <code style="background:#f4f4f5;padding:2px 6px;border-radius:4px">${ref}</code> and we'll sort it out.</p>
${eventUrl ? `<p style="margin-top:16px"><a href="${eventUrl}" style="display:inline-block;background:#1a1a1a;color:#fff;padding:10px 20px;border-radius:10px;text-decoration:none;font-weight:600;font-size:14px">Try again →</a></p>` : ""}
<p style="color:#6b7280;font-size:13px;margin-top:24px">TicketPulse &middot; <a href="mailto:nick@ticketpulse.co.zw" style="color:#6b7280">nick@ticketpulse.co.zw</a></p>
</div>`,
            text: `Hi ${name},\n\nYour order for ${eventTitle} has expired. If money was deducted, contact us with reference ${ref}.\n\n${eventUrl ? `Try again: ${eventUrl}\n\n` : ""}TicketPulse`,
          }).catch((err) =>
            log.warn("cron/expire-orders — expiry email failed", { orderId: order.id, error: String(err) }),
          )
        }),
      )
    }
  }

  return NextResponse.json({
    expired: expireIds.length,
    skipped: skippedVelocity.length,
  })
}
