"use server"

import { z } from "zod"
import { eq, and, inArray, isNotNull, ne, sql } from "drizzle-orm"
import { db } from "@/db"
import { events, orders, users, pastAnnounceLog } from "@/db/schema"
import { auth } from "@/auth"
import { sendEmail, sendBatchEmails } from "@/lib/email"
import { eventEmailTemplate, newEventAnnouncementTemplate } from "@/lib/email-templates"
import { requireEventAccess } from "@/lib/event-access"

const SendSchema = z.object({
  subject: z.string().min(1, "Subject is required").max(200, "Subject too long"),
  message: z.string().min(1, "Message is required").max(50000, "Message too long"),
})

export type EmailFormState = {
  ok: boolean
  error?: string
  sent?: number
  total?: number
}

async function getEventTitle(eventId: string): Promise<string> {
  const [ev] = await db.select({ title: events.title }).from(events).where(eq(events.id, eventId)).limit(1)
  return ev?.title ?? "your event"
}

async function getAttendeeEmails(eventId: string) {
  const rows = await db
    .select({
      guestEmail: orders.guestEmail,
      guestName: orders.guestName,
    })
    .from(orders)
    .where(
      and(
        eq(orders.eventId, eventId),
        inArray(orders.status, ["paid", "completed"]),
        isNotNull(orders.guestEmail),
      ),
    )

  // Deduplicate by email
  const seen = new Set<string>()
  return rows.filter((r) => {
    if (!r.guestEmail || seen.has(r.guestEmail)) return false
    seen.add(r.guestEmail)
    return true
  })
}

export async function getAttendeeEmailCount(eventId: string): Promise<number> {
  const access = await requireEventAccess(eventId)
  if (!access.allowed) return 0
  const rows = await db
    .select({ guestEmail: orders.guestEmail })
    .from(orders)
    .where(
      and(
        eq(orders.eventId, eventId),
        inArray(orders.status, ["paid", "completed"]),
        isNotNull(orders.guestEmail),
      ),
    )
  const seen = new Set<string>()
  for (const r of rows) {
    if (r.guestEmail) seen.add(r.guestEmail)
  }
  return seen.size
}

export async function sendBulkEmailAction(
  eventId: string,
  _prev: EmailFormState | undefined,
  formData: FormData,
): Promise<EmailFormState> {
  try {
    const access = await requireEventAccess(eventId)
    if (!access.allowed) throw new Error("Forbidden")
    const eventTitle = await getEventTitle(eventId)

    const parsed = SendSchema.safeParse({
      subject: formData.get("subject"),
      message: formData.get("message"),
    })
    if (!parsed.success) {
      const first = parsed.error.issues[0]
      return { ok: false, error: first?.message ?? "Invalid input" }
    }

    const { subject, message } = parsed.data
    const attendees = await getAttendeeEmails(eventId)

    if (attendees.length === 0) {
      return { ok: false, error: "No attendees found to email" }
    }

    const emails = attendees.map((attendee) => {
      const { html, text } = eventEmailTemplate({
        recipientName: attendee.guestName,
        eventTitle,
        subject,
        message,
      })
      return { to: attendee.guestEmail!, subject, html, text }
    })

    const { sent } = await sendBatchEmails(emails)
    return { ok: true, sent, total: attendees.length }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed to send emails" }
  }
}

export async function sendTestEmailAction(
  eventId: string,
  _prev: { ok: boolean; error?: string } | undefined,
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const access = await requireEventAccess(eventId)
    if (!access.allowed) throw new Error("Forbidden")
    const session = await auth()
    if (!session) throw new Error("Not authenticated")

    const parsed = SendSchema.safeParse({
      subject: formData.get("subject"),
      message: formData.get("message"),
    })
    if (!parsed.success) {
      const first = parsed.error.issues[0]
      return { ok: false, error: first?.message ?? "Invalid input" }
    }

    const { subject, message } = parsed.data

    const { html, text } = eventEmailTemplate({
      recipientName: session.user.name ?? "Organizer",
      eventTitle: "your event",
      subject,
      message,
    })

    await sendEmail({
      to: session.user.email!,
      subject: `[TEST] ${subject}`,
      html,
      text,
    })

    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed to send test email" }
  }
}

// ─── Past-attendee announcement ───────────────────────────────────────────────

async function getOrganizerAndEvent(eventId: string) {
  const [row] = await db
    .select({
      organizerId: events.organizerId,
      title: events.title,
      slug: events.slug,
      organizerName: users.name,
    })
    .from(events)
    .innerJoin(users, eq(users.id, events.organizerId))
    .where(eq(events.id, eventId))
    .limit(1)
  return row ?? null
}

/**
 * Count unique email addresses from the organizer's OTHER paid events
 * that have NOT yet received a past-attendee announcement for this event.
 */
export async function getPastEventAttendeeCount(eventId: string): Promise<number> {
  const access = await requireEventAccess(eventId)
  if (!access.allowed) return 0

  const ev = await getOrganizerAndEvent(eventId)
  if (!ev) return 0

  const pastEvents = await db
    .select({ id: events.id })
    .from(events)
    .where(and(eq(events.organizerId, ev.organizerId), ne(events.id, eventId)))

  if (!pastEvents.length) return 0

  const pastEventIds = pastEvents.map((e) => e.id)

  const [rows, alreadySentRows] = await Promise.all([
    db
      .select({ guestEmail: orders.guestEmail })
      .from(orders)
      .where(
        and(
          inArray(orders.eventId, pastEventIds),
          inArray(orders.status, ["paid", "completed"]),
          isNotNull(orders.guestEmail),
        ),
      ),
    db
      .select({ recipientEmail: pastAnnounceLog.recipientEmail })
      .from(pastAnnounceLog)
      .where(eq(pastAnnounceLog.eventId, eventId)),
  ])

  const alreadySent = new Set(alreadySentRows.map((r) => r.recipientEmail.toLowerCase()))
  const seen = new Set<string>()
  for (const r of rows) {
    if (!r.guestEmail) continue
    const key = r.guestEmail.toLowerCase()
    if (!alreadySent.has(key)) seen.add(key)
  }
  return seen.size
}

/**
 * Send a new-event announcement to attendees of the organizer's past events.
 * Uses Resend batch API (100 per call) to stay within rate limits.
 */
export async function sendPastAnnouncementAction(
  eventId: string,
  _prev: EmailFormState | undefined,
  formData: FormData,
): Promise<EmailFormState> {
  try {
    const access = await requireEventAccess(eventId)
    if (!access.allowed) throw new Error("Forbidden")

    const parsed = SendSchema.safeParse({
      subject: formData.get("subject"),
      message: formData.get("message"),
    })
    if (!parsed.success) {
      const first = parsed.error.issues[0]
      return { ok: false, error: first?.message ?? "Invalid input" }
    }

    const { subject, message } = parsed.data

    const ev = await getOrganizerAndEvent(eventId)
    if (!ev) throw new Error("Event not found")

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://ticketpulse.tech"
    const eventUrl = `${appUrl}/events/${ev.slug}`

    // Collect unique past attendee emails (excluding current event)
    const pastEvents = await db
      .select({ id: events.id })
      .from(events)
      .where(and(eq(events.organizerId, ev.organizerId), ne(events.id, eventId)))

    if (!pastEvents.length) {
      return { ok: false, error: "No past events found. Run another event first to build your audience." }
    }

    const pastEventIds = pastEvents.map((e) => e.id)

    const [rows, alreadySentRows] = await Promise.all([
      db
        .select({ guestEmail: orders.guestEmail, guestName: orders.guestName })
        .from(orders)
        .where(
          and(
            inArray(orders.eventId, pastEventIds),
            inArray(orders.status, ["paid", "completed"]),
            isNotNull(orders.guestEmail),
          ),
        ),
      db
        .select({ recipientEmail: pastAnnounceLog.recipientEmail })
        .from(pastAnnounceLog)
        .where(eq(pastAnnounceLog.eventId, eventId)),
    ])

    // Exclude anyone who already received an announcement for this event
    const alreadySent = new Set(alreadySentRows.map((r) => r.recipientEmail.toLowerCase()))
    const seen = new Map<string, string | null>()
    for (const r of rows) {
      if (!r.guestEmail) continue
      const key = r.guestEmail.toLowerCase()
      if (!alreadySent.has(key) && !seen.has(key)) seen.set(key, r.guestName)
    }

    if (!seen.size) {
      return { ok: false, error: "All past attendees have already received this announcement." }
    }

    const emails = Array.from(seen.entries()).map(([email, name]) => {
      const { html, text } = newEventAnnouncementTemplate({
        recipientName: name,
        newEventTitle: ev.title,
        newEventUrl: eventUrl,
        subject,
        message,
        organizerName: ev.organizerName ?? "the organizer",
      })
      return { to: email, subject, html, text }
    })

    const { sent, failed } = await sendBatchEmails(emails)

    // Log every successfully-sent address so future resends skip them
    if (sent > 0) {
      const logRows = emails.map((e) => ({
        eventId,
        recipientEmail: e.to.toLowerCase(),
      }))
      // Insert in chunks of 500; ON CONFLICT DO NOTHING skips duplicates
      const CHUNK = 500
      for (let i = 0; i < logRows.length; i += CHUNK) {
        await db
          .insert(pastAnnounceLog)
          .values(logRows.slice(i, i + CHUNK))
          .onConflictDoNothing()
      }
    }

    return { ok: true, sent, total: emails.length }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed to send emails" }
  }
}
