import { randomUUID } from "node:crypto"
import { generateOrderAccessUrl, signTicketPayload } from "@/lib/tickets"
import { getBaseUrl } from "@/lib/url-config"
import "server-only"
import { and, eq, gte, isNull, lte, or } from "drizzle-orm"
import { db } from "@/db"
import { events, orders, ticketTiers, whatsappCheckoutSessions } from "@/db/schema"
import { getTierAvailability } from "@/lib/ticket-availability"
import { sendText } from "@/lib/whatsapp"
import { log } from "@/lib/logger"

const RESTART_PATTERN = /^(cancel|restart|stop)$/i

type SellableTier = {
  tierId: string
  tierName: string
  price: number
  currency: string
  remaining: number
  maxPerOrder: number
}

type SellableEvent = {
  eventId: string
  eventTitle: string
  eventSlug: string
  startsAt: Date
  venue: string
  city: string
  tiers: SellableTier[]
}

/**
 * Currently purchasable published events and their available ticket tiers.
 * Prices mirror checkout: active early-bird pricing is shown when applicable.
 */
async function findSellableEvents(): Promise<SellableEvent[]> {
  const now = new Date()
  const rows = await db
    .select({
      eventId: events.id,
      eventTitle: events.title,
      eventSlug: events.slug,
      startsAt: events.startsAt,
      venue: events.venue,
      city: events.city,
      tierId: ticketTiers.id,
      tierName: ticketTiers.name,
      price: ticketTiers.price,
      currency: ticketTiers.currency,
      totalQuantity: ticketTiers.totalQuantity,
      soldQuantity: ticketTiers.soldQuantity,
      maxPerOrder: ticketTiers.maxPerOrder,
      salesStart: ticketTiers.salesStart,
      salesEnd: ticketTiers.salesEnd,
      earlyBirdPrice: ticketTiers.earlyBirdPrice,
      earlyBirdUntil: ticketTiers.earlyBirdUntil,
      earlyBirdQuantity: ticketTiers.earlyBirdQuantity,
    })
    .from(ticketTiers)
    .innerJoin(events, eq(events.id, ticketTiers.eventId))
    .where(and(
      eq(events.status, "published"),
      or(gte(events.startsAt, now), gte(events.endsAt, now)),
      or(isNull(ticketTiers.salesStart), lte(ticketTiers.salesStart, now)),
      or(isNull(ticketTiers.salesEnd), gte(ticketTiers.salesEnd, now)),
    ))
    .orderBy(events.startsAt, ticketTiers.price)
    .limit(500)

  const availability = await getTierAvailability(rows.map((row) => row.tierId))
  const byEvent = new Map<string, SellableEvent>()
  for (const row of rows) {
    const remaining = availability.get(row.tierId)?.availableQuantity ?? 0
    if (remaining < 1) continue

    const sold = row.soldQuantity ?? 0
    const earlyBirdActive = row.earlyBirdPrice !== null
      && (!row.earlyBirdUntil || row.earlyBirdUntil > now)
      && (row.earlyBirdQuantity === null || sold < row.earlyBirdQuantity)
    const price = Number(earlyBirdActive ? row.earlyBirdPrice : row.price)
    let event = byEvent.get(row.eventId)
    if (!event) {
      event = {
        eventId: row.eventId,
        eventTitle: row.eventTitle,
        eventSlug: row.eventSlug,
        startsAt: row.startsAt,
        venue: row.venue,
        city: row.city,
        tiers: [],
      }
      byEvent.set(row.eventId, event)
    }
    if (event.tiers.length < 8) {
      event.tiers.push({
        tierId: row.tierId,
        tierName: row.tierName,
        price,
        currency: row.currency ?? "USD",
        remaining,
        maxPerOrder: row.maxPerOrder ?? 10,
      })
    }
  }

  return [...byEvent.values()].slice(0, 10)
}

async function getSession(chatId: string) {
  const [row] = await db.select().from(whatsappCheckoutSessions).where(eq(whatsappCheckoutSessions.chatId, chatId)).limit(1)
  return row ?? null
}

async function upsertSession(chatId: string, values: Partial<typeof whatsappCheckoutSessions.$inferInsert>) {
  const [row] = await db
    .insert(whatsappCheckoutSessions)
    .values({ chatId, ...values })
    .onConflictDoUpdate({
      target: whatsappCheckoutSessions.chatId,
      set: { ...values, updatedAt: new Date() },
    })
    .returning()
  return row
}

function money(n: number, currency: string) {
  return `${currency} ${n.toFixed(2)}`
}

function eventDate(date: Date) {
  return new Intl.DateTimeFormat("en-ZW", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Africa/Harare",
  }).format(date)
}

async function offerTiers(chatId: string, event: SellableEvent, intro = "") {
  const tiers = event.tiers
  if (tiers.length === 0) {
    await sendText(chatId, `${intro ? `${intro}\n\n` : ""}Sorry, tickets for that event have just sold out. Reply *EVENTS* to browse other events.`)
    return
  }

  const oneTier = tiers.length === 1 ? tiers[0] : null
  await upsertSession(chatId, {
    step: oneTier ? "quantity" : "choose_event",
    eventId: event.eventId,
    tierId: oneTier?.tierId ?? null,
    quantity: null,
    guestName: null,
    guestEmail: null,
    guestPhone: null,
    orderId: null,
    checkoutMetadata: null,
    candidateEventIds: oneTier ? null : tiers.map((tier) => tier.tierId),
  })
  const details = `${intro ? `${intro}\n\n` : ""}🎟️ *${event.eventTitle}*\n${eventDate(event.startsAt)} · ${event.venue}, ${event.city}`
  if (oneTier) {
    await sendText(chatId, `${details}\n\n${oneTier.tierName} — ${money(oneTier.price, oneTier.currency)} (${oneTier.remaining} left)\n\nHow many tickets? Reply with a number, up to ${oneTier.maxPerOrder}.`)
    return
  }

  const list = tiers
    .map((tier, index) => `${index + 1}. ${tier.tierName} — ${money(tier.price, tier.currency)} (${tier.remaining} left)`)
    .join("\n")
  await sendText(chatId, `${details}\n\n${list}\n\nReply with the number of the ticket type you want.`)
}

async function showEvents(chatId: string, greet = false) {
  const intro = greet ? "Hi! 👋 I’m TicketPulse’s ticket assistant. Let’s find your tickets." : ""
  const candidates = await findSellableEvents()
  if (candidates.length === 0) {
    const existing = await getSession(chatId)
    if (existing && existing.step !== "done" && existing.step !== "cancelled") {
      await upsertSession(chatId, { step: "cancelled", eventId: null, tierId: null, candidateEventIds: null })
    }
    await sendText(chatId, `${intro ? `${intro}\n\n` : ""}There are no tickets available to buy right now. Please check back soon.`)
    return
  }
  if (candidates.length === 1) {
    await offerTiers(chatId, candidates[0], intro)
    return
  }

  await upsertSession(chatId, {
    step: "choose_event",
    eventId: null,
    tierId: null,
    quantity: null,
    guestName: null,
    guestEmail: null,
    guestPhone: null,
    orderId: null,
    checkoutMetadata: null,
    candidateEventIds: candidates.map((candidate) => candidate.eventId),
  })
  const list = candidates
    .map((candidate, index) => {
      const cheapest = candidate.tiers.reduce((a, b) => a.price <= b.price ? a : b)
      return `${index + 1}. *${candidate.eventTitle}* — ${eventDate(candidate.startsAt)}\n   ${candidate.venue}, ${candidate.city} · from ${money(cheapest.price, cheapest.currency)}`
    })
    .join("\n")
  await sendText(chatId, `${intro ? `${intro}\n\n` : ""}🎟️ *Events with tickets available*\n\n${list}\n\nReply with the event number. Type *CANCEL* to stop.`)
}

/**
 * Entry point for inbound WhatsApp text. It offers current published events,
 * collects event/tier/quantity/buyer details, and hands checkout to Velocity.
 */
export async function handleInboundWhatsAppMessage(chatId: string, rawBody: string): Promise<void> {
  const body = (rawBody ?? "").trim()
  if (!body) return

  const active = await getSession(chatId)
  if (active?.orderId) {
    const [recorded] = await db.select({ status: orders.status }).from(orders).where(eq(orders.id, active.orderId)).limit(1)
    if (recorded && ['pending', 'awaiting_verification', 'expired'].includes(recorded.status ?? '')) {
      await sendText(chatId, 'Your earlier payment is recorded. Please do not pay again. Check this secure order link: ' + generateOrderAccessUrl(active.orderId))
      return
    }
  }
  const checkoutMeta = active?.checkoutMetadata
  if (active && checkoutMeta?.quote && !active.orderId) {
    if (/^pay$/i.test(body)) { await completeCheckout(chatId, active, true); return }
    if (/^promo\s+/i.test(body)) {
      const next = await upsertSession(chatId, { checkoutMetadata: { ...checkoutMeta, quote: null, promoCode: body.replace(/^promo\s+/i, '').trim().toUpperCase() } })
      await completeCheckout(chatId, next); return
    }
    if (!RESTART_PATTERN.test(body)) { await sendText(chatId, 'Reply PAY to approve the reviewed total, PROMO followed by your code, or CANCEL before payment starts.'); return }
  }
  if (RESTART_PATTERN.test(body)) {
    const existing = await getSession(chatId)
    if (existing && existing.step !== "done" && existing.step !== "cancelled") {
      await upsertSession(chatId, { step: "cancelled", checkoutMetadata: null })
      await sendText(chatId, "No problem, cancelled. Reply *EVENTS* any time to start again.")
    }
    return
  }

  if (/^(events|menu|start|help)$/i.test(body)) {
    await showEvents(chatId)
    return
  }

  const session = await getSession(chatId)
  const inFlight = session && session.step !== "done" && session.step !== "cancelled"

  if (!inFlight) {
    await showEvents(chatId, true)
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
      const candidates = await findSellableEvents()
      if (!session!.eventId) {
        const chosen = candidates.find((candidate) => candidate.eventId === candidateIds[idx])
        if (!chosen) {
          await upsertSession(chatId, { step: "cancelled" })
          await sendText(chatId, "Sorry, that event is no longer available. Reply *EVENTS* to see what's still on sale.")
          return
        }
        await offerTiers(chatId, chosen)
        return
      }

      const selectedEvent = candidates.find((candidate) => candidate.eventId === session!.eventId)
      const selectedTier = selectedEvent?.tiers.find((tier) => tier.tierId === candidateIds[idx])
      if (!selectedEvent || !selectedTier) {
        await upsertSession(chatId, { step: "cancelled" })
        await sendText(chatId, "Sorry, that ticket type is no longer available. Reply *EVENTS* to start again.")
        return
      }
      await upsertSession(chatId, { step: "quantity", tierId: selectedTier.tierId, candidateEventIds: null })
      await sendText(chatId, `You selected *${selectedTier.tierName}* for *${selectedEvent.eventTitle}* at ${money(selectedTier.price, selectedTier.currency)} each. ${selectedTier.remaining} left.\n\nHow many tickets? Reply with a number, up to ${selectedTier.maxPerOrder}.`)
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
        await sendText(chatId, "Sorry, that ticket tier is no longer available. Reply *EVENTS* to start again.")
        return
      }
      const remaining = (tier.totalQuantity ?? 0) - (tier.soldQuantity ?? 0)
      if (qty > remaining) {
        await sendText(chatId, `Only ${remaining} left — reply with a smaller number.`)
        return
      }
      if (tier.maxPerOrder && qty > tier.maxPerOrder) {
        await sendText(chatId, `The maximum is ${tier.maxPerOrder} tickets per order — reply with a smaller number.`)
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

async function completeCheckout(chatId: string, session: typeof whatsappCheckoutSessions.$inferSelect, confirmed = false) {
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

  const previous = session.checkoutMetadata ?? {}
  const requestId = typeof previous.checkoutRequestId === 'string' ? previous.checkoutRequestId : randomUUID()
  await upsertSession(chatId, { checkoutMetadata: { ...previous, checkoutRequestId: requestId } })
  try {
    const res = await fetch(`${selfUrl}/api/checkout/velocity`, {
      signal: AbortSignal.timeout(60_000),
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        checkoutRequestId: requestId, quoteOnly: !confirmed,
        expectedAmount: (previous.quote as { amount?: number } | undefined)?.amount,
        expectedCurrency: (previous.quote as { currency?: string } | undefined)?.currency,
        promoCode: previous.promoCode,
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
      if (data.orderId) {
        await upsertSession(chatId, { orderId: data.orderId, step: 'done', checkoutMetadata: { ...previous, checkoutRequestId: requestId, accessSignature: data.accessSignature } })
        await sendText(chatId, 'Your payment outcome is still being checked. Please do not pay again. View your order: ' + generateOrderAccessUrl(data.orderId))
      } else {
        await sendText(chatId, (data.error ?? 'Checkout could not be reviewed.') + ' Reply with your details again to review this same order.')
        await upsertSession(chatId, { checkoutMetadata: { ...previous, checkoutRequestId: requestId, quote: null } })
      }
      return
    }
    if (!confirmed) {
      if (data.quote.questions.length) {
        await upsertSession(chatId, { step: 'cancelled', checkoutMetadata: null })
        await sendText(chatId, 'This event has attendee questions. Complete them, apply any promo, and review your payment securely here: ' + getBaseUrl() + '/events/' + event.slug)
        return
      }
      await upsertSession(chatId, { step: 'phone', checkoutMetadata: { ...previous, checkoutRequestId: requestId, quote: data.quote } })
      await sendText(chatId, 'Review your order: ' + session.quantity + ' ticket(s) for ' + event.title + '. Ticket price: ' + money(data.quote.subtotal + (data.quote.discount ?? 0), data.quote.currency) + (data.quote.discount ? '. Discount: -' + money(data.quote.discount, data.quote.currency) : '') + '. Gateway fees: ' + money(data.quote.gatewayFee, data.quote.currency) + '. Total: ' + money(data.quote.amount, data.quote.currency) + '. EcoCash prompt goes to ' + data.quote.normalizedPhone + '. Reply PAY to request payment, PROMO followed by a code, or CANCEL.')
      return
    }
    await upsertSession(chatId, { orderId: data.orderId, step: "done" })
    if (data.flow === 'free') { await sendText(chatId, 'Your free tickets are confirmed. View them here: ' + generateOrderAccessUrl(data.orderId)); return }
    await sendText(
      chatId,
      `✅ Almost there! Check your phone for an *EcoCash* payment prompt for ${money(Number(data.amount ?? 0), data.currency ?? "USD")} and enter your PIN to approve it.\n\nOnce it goes through, your ticket lands right here and by email.`,
    )

    // On the website the buyer's browser polls the status endpoint, which
    // confirms the payment with Velocity, finalizes the order, and triggers
    // ticket delivery. There's no browser here, so poll it ourselves.
    await pollPaymentUntilSettled(chatId, data.orderId, selfUrl, data.accessSignature)
  } catch (err) {
    log.error("whatsapp-checkout — completeCheckout failed", { chatId, error: err instanceof Error ? err.message : String(err) })
    await sendText(chatId, "Connection is delayed. Please do not pay again. Reply PAY to recover the same recorded attempt, or contact support.")
  }
}

async function pollPaymentUntilSettled(chatId: string, orderId: string, selfUrl: string, signature?: string): Promise<void> {
  const POLL_INTERVAL_MS = 6_000
  const MAX_POLLS = 20 // ~2 minutes

  for (let i = 0; i < MAX_POLLS; i++) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS))
    try {
      const res = await fetch(`${selfUrl}/api/checkout/velocity/status/${orderId}`, {
        signal: AbortSignal.timeout(15_000),
        headers: { "x-ticket-signature": signature ?? signTicketPayload(orderId, orderId) },
      })
      if (!res.ok) continue
      const status = await res.json()
      if (status.paid) {
        await sendText(chatId, "💚 Payment confirmed! Your ticket is on its way — you'll get the PDF right here in a moment.")
        return
      }
      if (status.status === "expired" || status.status === "failed") {
        await sendText(chatId, "This order is closed. If money was deducted, contact support before paying again.")
        return
      }
    } catch (err) {
      log.warn("whatsapp-checkout — payment poll error", { orderId, error: err instanceof Error ? err.message : String(err) })
    }
  }

  await sendText(
    chatId,
    "Still checking payment. Please do not pay again. View your recorded order: " + generateOrderAccessUrl(orderId),
  )
}
