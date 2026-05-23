"use server"

import { z } from "zod"
import { eq, and, inArray, isNotNull } from "drizzle-orm"
import { db } from "@/db"
import { events, orders } from "@/db/schema"
import { auth } from "@/auth"
import { sendEmail } from "@/lib/email"
import { eventEmailTemplate } from "@/lib/email-templates"

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

async function requireEventOwnership(eventId: string) {
  const session = await auth()
  if (!session) throw new Error("Not authenticated")

  const [event] = await db
    .select({ organizerId: events.organizerId, title: events.title })
    .from(events)
    .where(eq(events.id, eventId))
    .limit(1)

  if (!event) throw new Error("Event not found")
  if (event.organizerId !== session.user.id && session.user.role !== "admin") {
    throw new Error("Forbidden")
  }

  return { session, eventTitle: event.title }
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
        inArray(orders.status, ["paid"]),
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
  const rows = await db
    .select({ guestEmail: orders.guestEmail })
    .from(orders)
    .where(
      and(
        eq(orders.eventId, eventId),
        inArray(orders.status, ["paid"]),
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
    const { eventTitle } = await requireEventOwnership(eventId)

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

    let sent = 0
    for (const attendee of attendees) {
      try {
        const { html, text } = eventEmailTemplate({
          recipientName: attendee.guestName,
          eventTitle,
          subject,
          message,
        })
        await sendEmail({
          to: attendee.guestEmail!,
          subject,
          html,
          text,
        })
        sent++
        // Rate limiting: 500ms delay between sends
        if (sent < attendees.length) {
          await new Promise((r) => setTimeout(r, 500))
        }
      } catch (err) {
        console.error(`[bulk-email] failed to send to ${attendee.guestEmail}:`, err)
        // Continue with remaining recipients
      }
    }

    return { ok: true, sent, total: attendees.length }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed to send emails" }
  }
}

export async function sendTestEmailAction(
  _eventId: string,
  _prev: { ok: boolean; error?: string } | undefined,
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  try {
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
