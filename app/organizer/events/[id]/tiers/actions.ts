"use server"

import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { eq, sql } from "drizzle-orm"
import { z } from "zod"

import { auth } from "@/auth"
import { db } from "@/db"
import { events, ticketTiers, tickets, orderItems } from "@/db/schema"
import { trackOrganizerLifecycle } from "@/lib/organizer-lifecycle"

async function requireEventOwnership(eventId: string) {
  const session = await auth()
  if (!session?.user?.id) {
    return { ok: false as const, redirectTo: "/auth/signin" }
  }
  const [row] = await db
    .select({ id: events.id, organizerId: events.organizerId })
    .from(events)
    .where(eq(events.id, eventId))
    .limit(1)
  if (!row) return { ok: false as const, redirectTo: "/organizer" }
  if (row.organizerId !== session.user.id && session.user.role !== "admin") {
    return { ok: false as const, redirectTo: "/organizer" }
  }
  return { ok: true as const, session, event: row }
}

async function requireTierOwnership(tierId: string) {
  const session = await auth()
  if (!session?.user?.id) {
    return { ok: false as const, redirectTo: "/auth/signin" }
  }
  const [row] = await db
    .select({
      id: ticketTiers.id,
      eventId: ticketTiers.eventId,
      soldQuantity: ticketTiers.soldQuantity,
      organizerId: events.organizerId,
    })
    .from(ticketTiers)
    .innerJoin(events, eq(events.id, ticketTiers.eventId))
    .where(eq(ticketTiers.id, tierId))
    .limit(1)
  if (!row) return { ok: false as const, redirectTo: "/organizer" }
  if (row.organizerId !== session.user.id && session.user.role !== "admin") {
    return { ok: false as const, redirectTo: "/organizer" }
  }
  return { ok: true as const, session, tier: row }
}

const SaveSchema = z.object({
  eventId:           z.uuid(),
  tierId:            z.uuid().optional(),
  name:              z.string().trim().min(1, "Name is required").max(160),
  description:       z.string().trim().max(2000).optional(),
  price:             z.string().min(1, "Price is required"),
  currency:          z.string().trim().min(1).max(8).default("USD"),
  totalQuantity:     z.string().min(1, "Capacity is required"),
  maxPerOrder:       z.string().optional(),
  salesStart:        z.string().optional(),
  salesEnd:          z.string().optional(),
  earlyBirdPrice:    z.string().optional(),
  earlyBirdUntil:    z.string().optional(),
  earlyBirdQuantity: z.string().optional(),
  groupPrice:        z.string().optional(),
  groupMinQty:       z.string().optional(),
})

export type TierFormState = {
  ok: boolean
  error?: string
  message?: string
  fieldErrors?: Record<string, string>
}

function parseDateTimeLocal(value?: string): Date | null {
  if (!value) return null
  // <input type="datetime-local"> emits "YYYY-MM-DDTHH:MM" (no timezone).
  // We treat this as Africa/Harare (CAT, UTC+2) since that's the app's timezone.
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/)
  if (!m) return null
  const [_, year, month, day, hour, minute] = m
  // CAT is UTC+2. Zimbabwe does not observe DST.
  const catOffsetMs = 2 * 60 * 60 * 1000
  const utcMs = Date.UTC(+year, +month - 1, +day, +hour, +minute) - catOffsetMs
  const d = new Date(utcMs)
  return Number.isNaN(d.getTime()) ? null : d
}

export async function saveTierAction(
  _prev: TierFormState,
  formData: FormData,
): Promise<TierFormState> {
  const raw = {
    eventId:           formData.get("eventId")?.toString() ?? "",
    tierId:            formData.get("tierId")?.toString() || undefined,
    name:              formData.get("name")?.toString() ?? "",
    description:       formData.get("description")?.toString() ?? undefined,
    price:             formData.get("price")?.toString() ?? "",
    currency:          formData.get("currency")?.toString() || "USD",
    totalQuantity:     formData.get("totalQuantity")?.toString() ?? "",
    maxPerOrder:       formData.get("maxPerOrder")?.toString() ?? undefined,
    salesStart:        formData.get("salesStart")?.toString() ?? undefined,
    salesEnd:          formData.get("salesEnd")?.toString() ?? undefined,
    earlyBirdPrice:    formData.get("earlyBirdPrice")?.toString() ?? undefined,
    earlyBirdUntil:    formData.get("earlyBirdUntil")?.toString() ?? undefined,
    earlyBirdQuantity: formData.get("earlyBirdQuantity")?.toString() ?? undefined,
    groupPrice:        formData.get("groupPrice")?.toString() ?? undefined,
    groupMinQty:       formData.get("groupMinQty")?.toString() ?? undefined,
  }

  const parsed = SaveSchema.safeParse(raw)
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      const key = issue.path[0]
      if (typeof key === "string" && !fieldErrors[key]) fieldErrors[key] = issue.message
    }
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors }
  }
  const data = parsed.data

  const guard = await requireEventOwnership(data.eventId)
  if (!guard.ok) return { ok: false, error: "Not allowed." }

  const price = Number.parseFloat(data.price)
  if (Number.isNaN(price) || price < 0) {
    return { ok: false, error: "Invalid price.", fieldErrors: { price: "Must be 0 or more" } }
  }

  const total = Number.parseInt(data.totalQuantity, 10)
  if (Number.isNaN(total) || total < 1) {
    return { ok: false, error: "Invalid capacity.", fieldErrors: { totalQuantity: "Must be at least 1" } }
  }

  let maxPerOrder = 10
  if (data.maxPerOrder) {
    const n = Number.parseInt(data.maxPerOrder, 10)
    if (Number.isNaN(n) || n < 1) {
      return { ok: false, error: "Invalid max per order.", fieldErrors: { maxPerOrder: "Must be at least 1" } }
    }
    maxPerOrder = Math.min(n, total)
  }

  const salesStart = parseDateTimeLocal(data.salesStart)
  const salesEnd = parseDateTimeLocal(data.salesEnd)
  if (salesStart && salesEnd && salesEnd <= salesStart) {
    return { ok: false, error: "Sales must end after they start.", fieldErrors: { salesEnd: "Must be after sales start" } }
  }

  const earlyBirdPrice = data.earlyBirdPrice ? Number.parseFloat(data.earlyBirdPrice) : null
  const earlyBirdUntil = parseDateTimeLocal(data.earlyBirdUntil)
  const earlyBirdQuantity = data.earlyBirdQuantity ? Number.parseInt(data.earlyBirdQuantity, 10) : null
  if (earlyBirdPrice !== null && (Number.isNaN(earlyBirdPrice) || earlyBirdPrice < 0 || earlyBirdPrice >= price)) {
    return { ok: false, error: "Early bird price must be less than the regular price." }
  }

  const groupPrice = data.groupPrice ? Number.parseFloat(data.groupPrice) : null
  const groupMinQty = data.groupMinQty ? Number.parseInt(data.groupMinQty, 10) : null
  if (groupPrice !== null && (Number.isNaN(groupPrice) || groupPrice < 0 || groupPrice >= price)) {
    return { ok: false, error: "Group discount price must be less than the regular price.", fieldErrors: { groupPrice: "Must be less than regular price" } }
  }
  if (groupMinQty !== null && (Number.isNaN(groupMinQty) || groupMinQty < 2)) {
    return { ok: false, error: "Minimum group size must be at least 2.", fieldErrors: { groupMinQty: "Must be at least 2" } }
  }

  if (data.tierId) {
    const ownerCheck = await requireTierOwnership(data.tierId)
    if (!ownerCheck.ok || ownerCheck.tier.eventId !== data.eventId) {
      return { ok: false, error: "Not allowed." }
    }
    // Refuse to drop capacity below what's already sold — use a live COUNT
    // rather than the denormalized soldQuantity counter which can lag under load.
    const [soldRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(tickets)
      .where(eq(tickets.tierId, data.tierId))
    const sold = soldRow?.count ?? 0
    if (total < sold) {
      return {
        ok: false,
        error: `Capacity can't go below ${sold} (already sold).`,
        fieldErrors: { totalQuantity: `Already sold ${sold}` },
      }
    }
    await db
      .update(ticketTiers)
      .set({
        name:              data.name,
        description:       data.description || null,
        price:             price.toFixed(2),
        currency:          data.currency,
        totalQuantity:     total,
        maxPerOrder,
        salesStart,
        salesEnd,
        earlyBirdPrice:    earlyBirdPrice !== null ? earlyBirdPrice.toFixed(2) : null,
        earlyBirdUntil,
        earlyBirdQuantity: earlyBirdQuantity || null,
        groupPrice:        groupPrice !== null ? groupPrice.toFixed(2) : null,
        groupMinQty:       groupMinQty || null,
      })
      .where(eq(ticketTiers.id, data.tierId))
  } else {
    await db.insert(ticketTiers).values({
      eventId:           data.eventId,
      name:              data.name,
      description:       data.description || null,
      price:             price.toFixed(2),
      currency:          data.currency,
      totalQuantity:     total,
      maxPerOrder,
      salesStart,
      salesEnd,
      earlyBirdPrice:    earlyBirdPrice !== null ? earlyBirdPrice.toFixed(2) : null,
      earlyBirdUntil,
      earlyBirdQuantity: earlyBirdQuantity || null,
      groupPrice:        groupPrice !== null ? groupPrice.toFixed(2) : null,
      groupMinQty:       groupMinQty || null,
    })
    await trackOrganizerLifecycle({
      step: "TICKET_TIER_ADDED",
      organizerId: guard.event.organizerId,
      eventId: data.eventId,
      dedupeKey: `event:${data.eventId}:first-tier`,
      source: "organizer_web",
    })
  }

  revalidatePath(`/organizer/events/${data.eventId}/tiers`)
  return { ok: true, message: "Saved." }
}

export async function deleteTierAction(formData: FormData): Promise<void> {
  const tierId = formData.get("tierId")?.toString()
  const eventId = formData.get("eventId")?.toString()
  if (!tierId || !eventId) return

  const guard = await requireTierOwnership(tierId)
  if (!guard.ok) redirect(guard.redirectTo)

  // Delete tickets, nullify order item references, and delete the tier atomically
  await db.transaction(async (tx) => {
    // 1. Delete any tickets linked to this tier (tickets.tier_id is NOT NULL
    //    with no onDelete cascade, so they must be removed before the tier can
    //    be deleted)
    await tx
      .delete(tickets)
      .where(eq(tickets.tierId, tierId))

    // 2. Nullify order_items.tier_id references so the FK constraint doesn't block deletion
    await tx
      .update(orderItems)
      .set({ tierId: null })
      .where(eq(orderItems.tierId, tierId))

    // 3. Delete the tier itself
    await tx.delete(ticketTiers).where(eq(ticketTiers.id, tierId))
  })
  revalidatePath(`/organizer/events/${eventId}/tiers`)
}
