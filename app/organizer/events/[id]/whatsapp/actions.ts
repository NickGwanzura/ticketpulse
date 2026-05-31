"use server"

import { z } from "zod"
import { eq, and, inArray, isNotNull } from "drizzle-orm"
import { db } from "@/db"
import { events, orders, users } from "@/db/schema"
import { auth } from "@/auth"
import { sendBulk, sendText, formatChatId, isSessionReady, type BulkMessageItem } from "@/lib/whatsapp"
import { requireEventAccess } from "@/lib/event-access"

const SendSchema = z.object({
  message: z
    .string()
    .min(1, "Message is required")
    .max(4096, "Message too long for WhatsApp"),
})

export type WhatsAppFormState = {
  ok: boolean
  error?: string
  sent?: number
  total?: number
  batchId?: string
}

async function getEventTitle(eventId: string): Promise<string> {
  const [ev] = await db.select({ title: events.title }).from(events).where(eq(events.id, eventId)).limit(1)
  return ev?.title ?? "your event"
}

async function getAttendeePhones(eventId: string) {
  const rows = await db
    .select({
      guestPhone: orders.guestPhone,
      guestName: orders.guestName,
    })
    .from(orders)
    .where(
      and(
        eq(orders.eventId, eventId),
        inArray(orders.status, ["paid"]),
        isNotNull(orders.guestPhone),
      ),
    )

  // Deduplicate by phone
  const seen = new Set<string>()
  return rows.filter((r) => {
    if (!r.guestPhone || seen.has(r.guestPhone)) return false
    seen.add(r.guestPhone)
    return true
  })
}

export async function getAttendeePhoneCount(eventId: string): Promise<number> {
  const access = await requireEventAccess(eventId)
  if (!access.allowed) return 0
  const rows = await db
    .select({ guestPhone: orders.guestPhone })
    .from(orders)
    .where(
      and(
        eq(orders.eventId, eventId),
        inArray(orders.status, ["paid"]),
        isNotNull(orders.guestPhone),
      ),
    )
  const seen = new Set<string>()
  for (const r of rows) {
    if (r.guestPhone) seen.add(r.guestPhone)
  }
  return seen.size
}

function interpolateVariables(
  text: string,
  vars: { name?: string | null; event?: string | null },
): string {
  return text
    .replace(/\{name\}/g, vars.name ?? "there")
    .replace(/\{event\}/g, vars.event ?? "the event")
}

export async function sendBulkWhatsAppAction(
  eventId: string,
  _prev: WhatsAppFormState | undefined,
  formData: FormData,
): Promise<WhatsAppFormState> {
  try {
    const access = await requireEventAccess(eventId)
    if (!access.allowed) throw new Error("Forbidden")
    const eventTitle = await getEventTitle(eventId)

    const parsed = SendSchema.safeParse({
      message: formData.get("message"),
    })
    if (!parsed.success) {
      const first = parsed.error.issues[0]
      return { ok: false, error: first?.message ?? "Invalid input" }
    }

    const { message } = parsed.data

    // Check WhatsApp session is ready
    const ready = await isSessionReady()
    if (!ready) {
      return { ok: false, error: "WhatsApp session is not connected. Check OpenWA status." }
    }

    const attendees = await getAttendeePhones(eventId)

    if (attendees.length === 0) {
      return { ok: false, error: "No attendees with phone numbers found" }
    }

    if (attendees.length > 100) {
      return {
        ok: false,
        error: `Too many recipients (${attendees.length}). Maximum is 100 per batch.`,
      }
    }

    // Build bulk message items with template interpolation
    const messages: BulkMessageItem[] = attendees.map((a) => ({
      chatId: formatChatId(a.guestPhone!),
      type: "text" as const,
      content: {
        text: interpolateVariables(message, {
          name: a.guestName,
          event: eventTitle,
        }),
      },
    }))

    const result = await sendBulk(messages, {
      delayBetweenMessages: 3000,
      randomizeDelay: true,
    })

    return {
      ok: true,
      sent: messages.length,
      total: attendees.length,
      batchId: result.batchId,
    }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to send WhatsApp messages",
    }
  }
}

export async function sendTestWhatsAppAction(
  eventId: string,
  _prev: { ok: boolean; error?: string } | undefined,
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const access = await requireEventAccess(eventId)
    if (!access.allowed) throw new Error("Forbidden")
    const eventTitle = await getEventTitle(eventId)
    const session = await auth()

    const parsed = SendSchema.safeParse({
      message: formData.get("message"),
    })
    if (!parsed.success) {
      const first = parsed.error.issues[0]
      return { ok: false, error: first?.message ?? "Invalid input" }
    }

    const { message } = parsed.data

    // Check WhatsApp session is ready
    const ready = await isSessionReady()
    if (!ready) {
      return { ok: false, error: "WhatsApp session is not connected." }
    }

    // Look up the organizer's phone from the DB
    const [org] = await db
      .select({ phone: users.phone })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1)

    if (!org?.phone) {
      return {
        ok: false,
        error:
          "No phone number on your account. Add one in your profile settings to use the test feature.",
      }
    }

    const personalMessage = interpolateVariables(message, {
      name: session.user.name,
      event: eventTitle,
    })

    await sendText(formatChatId(org.phone), personalMessage)

    return { ok: true }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to send test message",
    }
  }
}
