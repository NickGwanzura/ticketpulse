"use server"

import { z } from "zod"
import { eq, and, inArray, isNotNull } from "drizzle-orm"
import { db } from "@/db"
import { events, orders, users } from "@/db/schema"
import { auth } from "@/auth"
import { sendCustomSms, getSmsBalance } from "@/lib/velocity/sms"
import { normaliseMsisdn, isValidMsisdn } from "@/lib/velocity/validation"
import { requireEventAccess } from "@/lib/event-access"
import { log } from "@/lib/logger"

const SendSchema = z.object({
  message: z
    .string()
    .min(1, "Message is required")
    .max(459, "Message too long (max 3 SMS segments — 459 characters)"),
})

export type SmsFormState = {
  ok: boolean
  error?: string
  sent?: number
  failed?: number
  total?: number
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
        inArray(orders.status, ["paid", "completed"]),
        isNotNull(orders.guestPhone),
      ),
    )

  // Normalize then dedupe — raw guestPhone values are inconsistently formatted
  // (0771234567 vs +263771234567 vs 263771234567 can all be the same number).
  const seen = new Map<string, { guestPhone: string; guestName: string | null }>()
  for (const r of rows) {
    if (!r.guestPhone || !isValidMsisdn(r.guestPhone)) continue
    const key = normaliseMsisdn(r.guestPhone)
    if (!seen.has(key)) seen.set(key, { guestPhone: r.guestPhone, guestName: r.guestName })
  }
  return Array.from(seen.values())
}

export async function getAttendeeSmsCount(eventId: string): Promise<number> {
  const access = await requireEventAccess(eventId)
  if (!access.allowed) return 0
  const attendees = await getAttendeePhones(eventId)
  return attendees.length
}

export async function getSmsBalanceForOrganizer(): Promise<number | null> {
  try {
    const { balance } = await getSmsBalance()
    return balance
  } catch {
    return null
  }
}

function interpolateVariables(text: string, vars: { name?: string | null; event?: string | null }): string {
  return text
    .replace(/\{name\}/g, vars.name ?? "there")
    .replace(/\{event\}/g, vars.event ?? "the event")
}

export async function sendBulkSmsAction(
  eventId: string,
  _prev: SmsFormState | undefined,
  formData: FormData,
): Promise<SmsFormState> {
  try {
    const access = await requireEventAccess(eventId)
    if (!access.allowed) throw new Error("Forbidden")
    const eventTitle = await getEventTitle(eventId)

    const parsed = SendSchema.safeParse({ message: formData.get("message") })
    if (!parsed.success) {
      const first = parsed.error.issues[0]
      return { ok: false, error: first?.message ?? "Invalid input" }
    }
    const { message } = parsed.data

    const attendees = await getAttendeePhones(eventId)
    if (attendees.length === 0) {
      return { ok: false, error: "No attendees with valid phone numbers found" }
    }

    const { balance } = await getSmsBalance()
    if (balance < attendees.length) {
      return {
        ok: false,
        error: `Not enough SMS credits. Need ${attendees.length}, have ${balance}. Top up before sending.`,
      }
    }

    let sent = 0
    let failed = 0
    for (const a of attendees) {
      const personalMessage = interpolateVariables(message, { name: a.guestName, event: eventTitle })
      try {
        await sendCustomSms(a.guestPhone, personalMessage)
        sent++
      } catch (err) {
        failed++
        log.warn("organizer sms — send failed", { eventId, error: err instanceof Error ? err.message : String(err) })
      }
      // Small spacing between sends so we don't hammer the provider.
      await new Promise((r) => setTimeout(r, 250))
    }

    return { ok: sent > 0, sent, failed, total: attendees.length }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to send SMS messages",
    }
  }
}

export async function sendTestSmsAction(
  eventId: string,
  _prev: { ok: boolean; error?: string } | undefined,
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const access = await requireEventAccess(eventId)
    if (!access.allowed) throw new Error("Forbidden")
    const eventTitle = await getEventTitle(eventId)
    const session = await auth()
    if (!session) throw new Error("Not authenticated")

    const parsed = SendSchema.safeParse({ message: formData.get("message") })
    if (!parsed.success) {
      const first = parsed.error.issues[0]
      return { ok: false, error: first?.message ?? "Invalid input" }
    }
    const { message } = parsed.data

    const [org] = await db
      .select({ phone: users.phone })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1)

    if (!org?.phone) {
      return {
        ok: false,
        error: "No phone number on your account. Add one in your profile settings to use the test feature.",
      }
    }

    const personalMessage = interpolateVariables(message, { name: session.user.name, event: eventTitle })
    await sendCustomSms(org.phone, personalMessage)

    return { ok: true }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to send test message",
    }
  }
}
