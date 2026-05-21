"use server"

import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { eq, and, desc, sql } from "drizzle-orm"
import { z } from "zod"

import { auth } from "@/auth"
import { db } from "@/db"
import { events, tickets, ticketTiers, eventOrganisers } from "@/db/schema"
import { requireEventAccess } from "@/lib/event-access"

const STAFF_ROLES = ["security", "usher", "dj_sound", "bar_staff", "vip_host", "media", "other"] as const

const GenerateStaffTicketSchema = z.object({
  eventId: z.uuid(),
  staffRole: z.enum(STAFF_ROLES),
  staffName: z.string().trim().min(1, "Staff name is required").max(160),
  staffPhone: z.string().trim().min(1, "Phone number is required").max(30),
})

export type StaffTicketState = {
  ok: boolean
  error?: string
  message?: string
  fieldErrors?: Record<string, string>
}

export async function generateStaffTicketAction(
  _prev: StaffTicketState,
  formData: FormData,
): Promise<StaffTicketState> {
  const raw = {
    eventId: formData.get("eventId")?.toString() ?? "",
    staffRole: formData.get("staffRole")?.toString() ?? "",
    staffName: formData.get("staffName")?.toString() ?? "",
    staffPhone: formData.get("staffPhone")?.toString() ?? "",
  }

  const parsed = GenerateStaffTicketSchema.safeParse(raw)
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      const key = issue.path[0]
      if (typeof key === "string" && !fieldErrors[key]) fieldErrors[key] = issue.message
    }
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors }
  }

  const data = parsed.data

  const access = await requireEventAccess(data.eventId)
  if (!access.allowed) {
    return { ok: false, error: "Not allowed." }
  }

  // Find a free ticket tier to link the staff ticket to
  const [tier] = await db
    .select({ id: ticketTiers.id, name: ticketTiers.name })
    .from(ticketTiers)
    .where(eq(ticketTiers.eventId, data.eventId))
    .limit(1)

  if (!tier) {
    return { ok: false, error: "No ticket tiers found for this event. Create a tier first." }
  }

  // Generate a unique QR code
  const qrCode = `STAFF-${crypto.randomUUID().toUpperCase().slice(0, 8)}`

  await db.insert(tickets).values({
    tierId: tier.id,
    eventId: data.eventId,
    status: "available",
    qrCode,
    isStaffTicket: true,
    staffRole: data.staffRole as typeof STAFF_ROLES[number],
    staffName: data.staffName,
    staffPhone: data.staffPhone,
  })

  revalidatePath(`/organizer/events/${data.eventId}/staff`)
  return { ok: true, message: `Staff ticket generated for ${data.staffName}. QR: ${qrCode}` }
}

export async function cancelStaffTicketAction(formData: FormData): Promise<void> {
  const ticketId = formData.get("ticketId")?.toString()
  const eventId = formData.get("eventId")?.toString()
  if (!ticketId || !eventId) return

  const access = await requireEventAccess(eventId)
  if (!access.allowed) redirect("/organizer")

  await db
    .update(tickets)
    .set({ status: "cancelled" })
    .where(
      and(
        eq(tickets.id, ticketId),
        eq(tickets.eventId, eventId),
        eq(tickets.isStaffTicket, true),
      ),
    )

  revalidatePath(`/organizer/events/${eventId}/staff`)
}

export type StaffTicket = {
  id: string
  staffName: string | null
  staffRole: string | null
  staffPhone: string | null
  qrCode: string | null
  status: string | null
  scannedAt: Date | null
  createdAt: Date | null
}

export interface StaffTicketsPageData {
  eventTitle: string
  totalStaffTickets: number
  activeCount: number
  usedCount: number
  cancelledCount: number
  tickets: StaffTicket[]
}
