import "server-only"
import { and, eq, gte, isNull, or, sql } from "drizzle-orm"
import { db } from "@/db"
import { events, ticketTiers, whatsappCheckoutSessions } from "@/db/schema"
import { sendText } from "@/lib/whatsapp"
import { log } from "@/lib/logger"

const TRIGGER_PATTERN = /early\s*bird/i
const RESTART_PATTERN = /^(cancel|restart|stop)$/i

type EarlyBirdCandidate = {
  eventId: string
  eventTitle: string
  eventSlug: string
  tierId: string
  tierName: string
  price: number
  currency: string
  remaining: number
  maxPerOrder: number
}

/**
 * Events with a currently-active early-bird tier (date and quantity window
 * both still open), ordered by start date. One entry per event — if an event
 * has multiple early-bird tiers, the cheapest is offered.
 */
async function findActiveEarlyBirdEvents(): Promise<EarlyBirdCandidate[]> {
  const now = new Date()
  const rows = await db
    .select({
      eventId: events.id,
      eventTitle: events.title,
      eventSlug: events.slug,
      tierId: ticketTiers.id,
      tierName: ticketTiers.name,
      price: ticketTiers.earlyBirdPrice,
      currency: ticketTiers.currency,
      totalQuantity: ticketTiers.totalQuantity,
      soldQuantity: ticketTiers.soldQuantity,
      maxPerOrder: ticketTiers.maxPerOrder,
      earlyBirdUntil: ticketTiers.earlyBirdUntil,
      earlyBirdQuantity: ticketTiers.earlyBirdQuantity,
    })
    .from(ticketTiers)
    .innerJoin(events, eq(events.id, ticketTiers.eventId))
    .where(and(
      eq(events.status, "published"),
      gte(events.startsAt, now),
      sql`${ticketTiers.earlyBirdPrice} IS NOT NULL`,
      or(isNull(ticketTiers.earlyBirdUntil), gte(ticketTiers.earlyBirdUntil, now)),
    ))
    .orderBy(events.startsAt)

  const byEvent = new Map<string, EarlyBirdCandidate>()
  for (const r of rows) {
    const sold = r.soldQuantity ?? 0
    const remaining = (r.totalQuantity ?? 0) - sold
    if (remaining < 1) continue
    if (r.earlyBirdQuantity !== null && sold >= r.earlyBirdQuantity) continue

    const price = Number(r.price)
    const existing = byEvent.get(r.eventId)
    if (!existing || price < existing.price) {
      byEvent.set(r.eventId, {
        eventId: r.eventId,
        eventTitle: r.eventTitle,
        eventSlug: r.eventSlug,
        tierId: r.tierId,
        tierName: r.tierName,
        price,
        currency: r.currency ?? "USD",
        remaining,
        maxPerOrder: r.maxPerOrder ?? 10,
      })
    }
  }
  return [...byEvent.values()]
}

async function getSession(chatId: string) {
  const [row] = await db.select().from(whatsappCheckoutSessions).where(eq(whatsappCheckoutSessions.chatId, chatId)).limit(1)
  return row ?? null
}

async function upsertSession(chatId: string, values: Partial<typeof whatsappCheckoutSessions.$inferInsert>) {
  const existing = await getSession(chatId)
  if (!existing) {
    const [row] = await db.insert(whatsappCheckoutSessions).values({ chatId, ...values }).returning()
    return row
  }
  const [row] = await db
    .update(whatsappCheckoutSessions)
    .set({ ...values, updatedAt: new Date() })
    .where(eq(whatsappCheckoutSessions.chatId, chatId))
    .returning()
  return row
}

function money(n: number, currency: string) {
  return `${currency} ${n.toFixed(2)}`
}

async function offerEvent(chatId: string, candidate: EarlyBirdCandidate) {
  await upsertSession(chatId, {
    step: "quantity",
    eventId: candidate.eventId,
    tierId: candidate.tierId,
    quantity: null,
    guestName: null,
    guestEmail: null,
    orderId: null,
    candidateEventIds: null,
  })
  await sendText(
    chatId,
    `🎟️ *Early Bird — ${candidate.eventTitle}*\n${candidate.tierName} @ ${money(candidate.price, candidate.currency)}\n(${candidate.remaining} left)\n\nHow many tickets would you like? (reply with a number, max ${candidate.maxPerOrder})`,
  )
}

/**
 * Entry point for an inbound WhatsApp text message. Drives the "text
 * EARLYBIRD to buy" conversation for the given chat. Safe to call for any
 * inbound message — no-ops silently for messages that aren't part of an
 * active or newly-triggered checkout flow.
 */
export async function handleInboundWhatsAppMessage(chatId: string, rawBody: string): Promise<void> {
  const body = (rawBody ?? "").trim()
  if (!body) return

  if (RESTART_PATTERN.test(body)) {
    const existing = await getSession(chatId)
    if (existing && existing.step !== "done" && existing.step !== "cancelled") {
      await upsertSession(chatId, { step: "cancelled" })
      await sendText(chatId, "No problem, cancelled. Text *EARLYBIRD* any time to start again.")
    }
    return
  }

  const session = await getSession(chatId)
  const inFlight = session && session.step !== "done" && session.step !== "cancelled"

  if (!inFlight) {
    if (!TRIGGER_PATTERN.test(body)) return // don't reply to unrelated messages

    const candidates = await findActiveEarlyBirdEvents()
    if (candidates.length === 0) {
      await sendText(chatId, "Sorry, there are no early bird tickets available right now. Check back soon!")
      return
    }
    if (candidates.length === 1) {
      await offerEvent(chatId, candidates[0])
      return
    }

    await upsertSession(chatId, {
      step: "choose_event",
      eventId: null,
      tierId: null,
      quantity: null,
      guestName: null,
      guestEmail: null,
      orderId: null,
      candidateEventIds: candidates.map((c) => c.eventId),
    })
    const list = candidates
      .map((c, i) => `${i + 1}. ${c.eventTitle} — ${money(c.price, c.currency)}`)
      .join("\n")
    await sendText(chatId, `🎟️ *Early Bird tickets available:*\n${list}\n\nReply with the number of the event you want.`)
    return
  }

  switch (session!.step) {
    case "choose_event": {
      const idx = parseInt(body, 10) - 1
      const candidateIds = (session!.candidateEventIds as string[] | null) ?? []
      if (!Number.isFinite(idx) || idx < 0 || idx >= candidateIds.length) {
        await sendText(chatId, `Please reply with a number from 1 to ${candidateIds.length}.`)
        return
      }
      const candidates = await findActiveEarlyBirdEvents()
      const chosen = candidates.find((c) => c.eventId === candidateIds[idx])
      if (!chosen) {
        await upsertSession(chatId, { step: "cancelled" })
        await sendText(chatId, "Sorry, that early bird offer just ran out. Text *EARLYBIRD* to see what's still available.")
        return
      }
      await offerEvent(chatId, chosen)
      return
    }

    case "quantity": {
      const qty = parseInt(body, 10)
      if (!Number.isFinite(qty) || qty < 1) {
        await sendText(chatId, "Please reply with a valid number of tickets, e.g. \"2\".")
        return
      }
      const [tier] = await db.select().from(ticketTiers).where(eq(ticketTiers.id, session!.tierId!)).limit(1)
      if (!tier) {
        await upsertSession(chatId, { step: "cancelled" })
        await sendText(chatId, "Sorry, that ticket tier is no longer available. Text *EARLYBIRD* to start again.")
        return
      }
      const remaining = (tier.totalQuantity ?? 0) - (tier.soldQuantity ?? 0)
      if (qty > remaining) {
        await sendText(chatId, `Only ${remaining} left — reply with a smaller number.`)
        return
      }
      if (tier.maxPerOrder && qty > tier.maxPerOrder) {
        await sendText(chatId, `Max ${tier.maxPerOrder} per order — reply with a smaller number.`)
        return
      }
      await upsertSession(chatId, { quantity: qty, step: "name" })
      await sendText(chatId, "Great — what's your full name?")
      return
    }

    case "name": {
      if (body.length < 2 || body.length > 120) {
        await sendText(chatId, "Please reply with your full name.")
        return
      }
      await upsertSession(chatId, { guestName: body, step: "email" })
      await sendText(chatId, "And your email address? (your ticket + receipt go here too)")
      return
    }

    case "email": {
      const email = body.toLowerCase()
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        await sendText(chatId, "That doesn't look like a valid email — please try again.")
        return
      }
      // When the sender's chat id is a plain phone id we can charge that
      // number directly; @lid privacy ids carry no phone, so ask for one.
      const phoneDigits = chatId.match(/^(\d+)@c\.us$/)?.[1] ?? null
      const phoneFromChat = phoneDigits ? `+${phoneDigits}` : null
      if (phoneFromChat) {
        await upsertSession(chatId, { guestEmail: email, guestPhone: phoneFromChat })
        await completeCheckout(chatId, { ...session!, guestEmail: email, guestPhone: phoneFromChat })
      } else {
        await upsertSession(chatId, { guestEmail: email, step: "phone" })
        await sendText(chatId, "Last step — what's your *EcoCash number*? (the payment prompt goes there, e.g. 0771234567)")
      }
      return
    }

    case "phone": {
      const digits = body.replace(/\D/g, "")
      const msisdn = digits.startsWith("0") ? `263${digits.slice(1)}` : digits
      if (!/^263\d{9}$/.test(msisdn)) {
        await sendText(chatId, "That doesn't look like a valid number — reply like 0771234567.")
        return
      }
      // Velocity's validator requires the leading + on international numbers.
      await upsertSession(chatId, { guestPhone: `+${msisdn}` })
      await completeCheckout(chatId, { ...session!, guestPhone: `+${msisdn}` })
      return
    }

    default:
      return
  }
}

async function completeCheckout(chatId: string, session: typeof whatsappCheckoutSessions.$inferSelect) {
  const [event] = await db.select().from(events).where(eq(events.id, session.eventId!)).limit(1)
  if (!event) {
    await upsertSession(chatId, { step: "cancelled" })
    await sendText(chatId, "Sorry, something went wrong finding that event. Text *EARLYBIRD* to start again.")
    return
  }

  const phone = session.guestPhone ?? chatId.replace(/@c\.us$/, "")

  // Self-call via loopback, not the public URL: container-to-own-host-IP
  // traffic (hairpin NAT) hangs on this deployment.
  const selfUrl = `http://127.0.0.1:${process.env.PORT ?? 3000}`

  try {
    const res = await fetch(`${selfUrl}/api/checkout/velocity`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: session.guestEmail,
        name: session.guestName,
        phone,
        paymentMethod: "velocity-ecocash",
        eventSlug: event.slug,
        items: [{ kind: "ticket", tierId: session.tierId, quantity: session.quantity }],
      }),
    })
    const data = await res.json()

    if (!res.ok || data.error) {
      await upsertSession(chatId, { step: "cancelled" })
      await sendText(chatId, `Sorry — ${data.error ?? "checkout failed"}. Text *EARLYBIRD* to try again.`)
      return
    }

    await upsertSession(chatId, { orderId: data.orderId, step: "done" })
    await sendText(
      chatId,
      `✅ Almost there! Check your phone for an *EcoCash* payment prompt for ${money(Number(data.amount ?? 0), data.currency ?? "USD")} and enter your PIN to approve it.\n\nOnce it goes through, your ticket lands right here and by email.`,
    )
  } catch (err) {
    log.error("whatsapp-checkout — completeCheckout failed", { chatId, error: err instanceof Error ? err.message : String(err) })
    await upsertSession(chatId, { step: "cancelled" })
    await sendText(chatId, "Sorry, something went wrong starting your payment. Text *EARLYBIRD* to try again.")
  }
}
