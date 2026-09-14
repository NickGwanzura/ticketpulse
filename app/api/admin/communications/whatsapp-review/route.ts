import { NextRequest, NextResponse } from "next/server"
import { and, desc, eq, inArray, sql } from "drizzle-orm"
import { z } from "zod"

import { auth } from "@/auth"
import { db } from "@/db"
import { events, orders } from "@/db/schema"
import { formatChatId, getSession, sendBulk } from "@/lib/whatsapp"
import { reviewRequestMessage } from "@/lib/whatsapp-templates"
import { sendEmail } from "@/lib/email"
import { reviewRequestEmail } from "@/lib/email-templates/transactional"
import { rateLimit } from "@/lib/rate-limit"

const reviewBatchLimiter = rateLimit({ windowMs: 10 * 60_000, max: 2 })
const Body = z.object({
  eventId: z.string().uuid(),
  limit: z.number().int().min(1).max(100).default(100),
  channels: z.array(z.enum(["whatsapp", "email"])).min(1).max(2).default(["whatsapp"]),
})

type Candidate = {
  id: string
  guestName: string | null
  guestEmail: string | null
  guestPhone: string | null
  paymentRef: string | null
  metadata: unknown
}

function isAdmin(session: { user?: { role?: string | null } } | null) {
  return session?.user?.role === "admin"
}

function appUrl() {
  return process.env.NEXT_PUBLIC_APP_URL ?? "https://ticketpulse.tech"
}

function communicationsMetadata(candidate: Candidate): Record<string, unknown> {
  const metadata = (candidate.metadata ?? {}) as Record<string, unknown>
  return (metadata.communications ?? {}) as Record<string, unknown>
}

function reviewUrl(eventSlug: string, candidate: Candidate) {
  const params = new URLSearchParams({
    event: eventSlug,
    name: candidate.guestName ?? "",
    email: candidate.guestEmail ?? "",
    order: candidate.paymentRef ?? candidate.id,
  })
  return `${appUrl()}/reviews/new?${params.toString()}`
}

/** Returns OpenWA health and past events with unsent buyer counts. */
export async function GET() {
  const session = await auth()
  if (!isAdmin(session)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const [pastEvents, sessionInfo] = await Promise.all([
    db
      .select({ id: events.id, title: events.title, slug: events.slug, startsAt: events.startsAt, endsAt: events.endsAt })
      .from(events)
      .where(sql`COALESCE(${events.endsAt}, ${events.startsAt}) < NOW()`)
      .orderBy(desc(events.endsAt))
      .limit(50),
    getSession().catch(() => null),
  ])

  const counts = pastEvents.length === 0
    ? []
    : await db
      .select({
        eventId: orders.eventId,
        phoneCount: sql<number>`COUNT(DISTINCT ${orders.guestPhone}) FILTER (
          WHERE ${orders.guestPhone} IS NOT NULL
            AND COALESCE(${orders.metadata}->'communications'->>'review_invite_sent_at', '') = ''
        )::int`,
        emailCount: sql<number>`COUNT(DISTINCT ${orders.guestEmail}) FILTER (
          WHERE ${orders.guestEmail} IS NOT NULL
            AND COALESCE(${orders.metadata}->'communications'->>'review_invite_email_sent_at', '') = ''
        )::int`,
      })
      .from(orders)
      .where(and(inArray(orders.eventId, pastEvents.map((event) => event.id)), inArray(orders.status, ["paid", "completed"])))
      .groupBy(orders.eventId)

  const countByEvent = new Map(counts.map((row) => [row.eventId, row]))
  return NextResponse.json({
    provider: process.env.WHATSAPP_PROVIDER ?? "openwa",
    session: sessionInfo
      ? { status: sessionInfo.status, phone: sessionInfo.phone, lastActive: sessionInfo.lastActive }
      : { status: "unreachable", phone: null, lastActive: null },
    events: pastEvents.map((event) => ({
      ...event,
      eligibleRecipients: Number(countByEvent.get(event.id)?.phoneCount ?? 0),
      eligibleEmailRecipients: Number(countByEvent.get(event.id)?.emailCount ?? 0),
    })),
  })
}

/** Sends a fixed thank-you/review message through one or both channels. */
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!isAdmin(session)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const rl = reviewBatchLimiter.checkRequest(req)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "A review batch was sent recently. Please wait before starting another." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } },
    )
  }

  const parsed = Body.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "eventId, channels, and a limit between 1 and 100 are required" }, { status: 400 })
  const wantsWhatsApp = parsed.data.channels.includes("whatsapp")
  const wantsEmail = parsed.data.channels.includes("email")

  if (wantsWhatsApp && (process.env.WHATSAPP_PROVIDER ?? "openwa").trim().toLowerCase() !== "openwa") {
    return NextResponse.json({ error: "WhatsApp review batches require the OpenWA provider." }, { status: 503 })
  }

  const [event] = await db
    .select({ id: events.id, title: events.title, slug: events.slug, startsAt: events.startsAt, endsAt: events.endsAt })
    .from(events)
    .where(eq(events.id, parsed.data.eventId))
    .limit(1)
  if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 })
  const eventEndedAt = event.endsAt ?? event.startsAt
  if (eventEndedAt.getTime() >= Date.now()) {
    return NextResponse.json({ error: "Thank-you messages can only be sent after an event has ended." }, { status: 400 })
  }

  const sessionInfo = wantsWhatsApp ? await getSession().catch(() => null) : null
  if (wantsWhatsApp && (!sessionInfo || sessionInfo.status !== "ready")) {
    return NextResponse.json({ error: `OpenWA is not ready (${sessionInfo?.status ?? "unreachable"}). Reconnect WhatsApp before sending.` }, { status: 503 })
  }

  const candidates = await db
    .select({
      id: orders.id,
      guestName: orders.guestName,
      guestEmail: orders.guestEmail,
      guestPhone: orders.guestPhone,
      paymentRef: orders.paymentRef,
      metadata: orders.metadata,
    })
    .from(orders)
    .where(and(eq(orders.eventId, event.id), inArray(orders.status, ["paid", "completed"])))
    .orderBy(desc(orders.createdAt))
    .limit(500) as Candidate[]

  const phoneGroups = new Map<string, Candidate[]>()
  if (wantsWhatsApp) {
    for (const candidate of candidates) {
      if (!candidate.guestPhone || communicationsMetadata(candidate).reviewInviteSentAt) continue
      const key = formatChatId(candidate.guestPhone)
      const group = phoneGroups.get(key) ?? []
      group.push(candidate)
      phoneGroups.set(key, group)
    }
  }
  const selectedPhoneGroups = Array.from(phoneGroups.entries()).slice(0, parsed.data.limit)

  const emailRecipients = new Map<string, Candidate>()
  if (wantsEmail) {
    for (const candidate of candidates) {
      if (!candidate.guestEmail || communicationsMetadata(candidate).reviewInviteEmailSentAt) continue
      emailRecipients.set(candidate.guestEmail.toLowerCase(), candidate)
    }
  }
  const selectedEmailRecipients = Array.from(emailRecipients.values()).slice(0, parsed.data.limit)

  if (wantsWhatsApp && selectedPhoneGroups.length === 0 && wantsEmail && selectedEmailRecipients.length === 0) {
    return NextResponse.json({ error: "No eligible buyers remain for this event." }, { status: 400 })
  }
  if (wantsWhatsApp && selectedPhoneGroups.length === 0 && !wantsEmail) {
    return NextResponse.json({ error: "No eligible buyers with WhatsApp numbers remain for this event." }, { status: 400 })
  }
  if (wantsEmail && selectedEmailRecipients.length === 0 && !wantsWhatsApp) {
    return NextResponse.json({ error: "No eligible buyers with email addresses remain for this event." }, { status: 400 })
  }

  let batch: Awaited<ReturnType<typeof sendBulk>> | null = null
  if (wantsWhatsApp) {
    const messages = selectedPhoneGroups.map(([chatId, group]) => ({
      chatId,
      type: "text" as const,
      content: { text: reviewRequestMessage(event.title, group[0].guestName ?? "there", reviewUrl(event.slug, group[0])) },
    }))
    try {
      batch = await sendBulk(messages, { delayBetweenMessages: 3_000, randomizeDelay: true, stopOnError: false })
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "OpenWA batch send failed" }, { status: 502 })
    }
  }

  let emailSent = 0
  let emailFailed = 0
  const successfulEmailIds = new Set<string>()
  if (wantsEmail) {
    for (let index = 0; index < selectedEmailRecipients.length; index += 10) {
      const chunk = selectedEmailRecipients.slice(index, index + 10)
      const results = await Promise.all(chunk.map(async (candidate) => {
        try {
          const message = reviewRequestEmail({ name: candidate.guestName, eventTitle: event.title, reviewUrl: reviewUrl(event.slug, candidate) })
          await sendEmail({ to: candidate.guestEmail!, subject: "Tell us about your TicketPulse experience", html: message.html, text: message.text })
          return { id: candidate.id, success: true }
        } catch {
          return { id: candidate.id, success: false }
        }
      }))
      for (const result of results) {
        if (result.success) {
          emailSent += 1
          successfulEmailIds.add(result.id)
        } else {
          emailFailed += 1
        }
      }
    }
  }

  const sentAt = new Date().toISOString()
  const toMark = new Map<string, { candidate: Candidate; whatsapp: boolean; email: boolean }>()
  if (wantsWhatsApp) {
    for (const [, group] of selectedPhoneGroups) for (const candidate of group) {
      toMark.set(candidate.id, { candidate, whatsapp: true, email: false })
    }
  }
  if (wantsEmail) {
    for (const candidate of selectedEmailRecipients) {
      if (!successfulEmailIds.has(candidate.id)) continue
      const current = toMark.get(candidate.id)
      toMark.set(candidate.id, { candidate, whatsapp: current?.whatsapp ?? false, email: true })
    }
  }
  await db.transaction(async (tx) => {
    for (const { candidate, whatsapp, email } of toMark.values()) {
      const metadata = (candidate.metadata ?? {}) as Record<string, unknown>
      const communications = (metadata.communications ?? {}) as Record<string, unknown>
      await tx.update(orders).set({
        metadata: {
          ...metadata,
          communications: {
            ...communications,
            ...(whatsapp ? { reviewInviteSentAt: sentAt, reviewInviteBatchId: batch?.batchId ?? null } : {}),
            ...(email ? { reviewInviteEmailSentAt: sentAt } : {}),
          },
        },
        updatedAt: new Date(),
      }).where(eq(orders.id, candidate.id))
    }
  })

  return NextResponse.json({
    ok: true,
    batchId: batch?.batchId ?? null,
    totalMessages: selectedPhoneGroups.length,
    emailSent,
    emailFailed,
    ordersMarked: toMark.size,
    skippedDuplicatePhones: selectedPhoneGroups.reduce((total, [, group]) => total + Math.max(0, group.length - 1), 0),
    estimatedCompletionTime: batch?.estimatedCompletionTime ?? null,
    statusUrl: batch?.statusUrl ?? null,
  })
}
