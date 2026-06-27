"use server"

import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { eq, and } from "drizzle-orm"
import { z } from "zod"

import { auth } from "@/auth"
import { db } from "@/db"
import { events, promoCodes } from "@/db/schema"

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

const CreatePromoSchema = z.object({
  code: z.string().trim().min(1, "Code is required").max(40).transform((v) => v.toUpperCase()),
  type: z.enum(["percent", "fixed"]),
  value: z.string().min(1, "Value is required"),
  maxUses: z.string().optional(),
  minPurchaseAmount: z.string().optional(),
  expiresAt: z.string().refine((s) => !Number.isNaN(new Date(s).getTime()), { message: "Invalid expiry date" }).optional(),
})

export type PromoFormState = {
  ok: boolean
  error?: string
  message?: string
  fieldErrors?: Record<string, string>
}

export async function createPromoCodeAction(
  eventId: string,
  _prev: PromoFormState,
  formData: FormData,
): Promise<PromoFormState> {
  const ownership = await requireEventOwnership(eventId)
  if (!ownership.ok) redirect(ownership.redirectTo)

  const raw: Record<string, FormDataEntryValue> = {}
  formData.forEach((v, k) => { raw[k] = v })

  const parsed = CreatePromoSchema.safeParse(raw)
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      const key = issue.path.join(".")
      if (!fieldErrors[key]) fieldErrors[key] = issue.message
    }
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors }
  }

  const { code, type, value, maxUses, minPurchaseAmount, expiresAt } = parsed.data

  // Check for duplicate code on this event
  const [existing] = await db
    .select({ id: promoCodes.id })
    .from(promoCodes)
    .where(and(eq(promoCodes.code, code), eq(promoCodes.eventId, eventId)))
    .limit(1)
  if (existing) {
    return { ok: false, error: `Promo code "${code}" already exists for this event.`, fieldErrors: { code: "Already exists" } }
  }

  try {
    await db.insert(promoCodes).values({
      eventId,
      code,
      type,
      value,
      maxUses: maxUses ? Number(maxUses) : 0,
      minPurchaseAmount: minPurchaseAmount || "0",
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      active: true,
    })
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed to create promo code" }
  }

  revalidatePath(`/organizer/events/${eventId}/promos`)
  return { ok: true, message: `Promo code "${code}" created.` }
}

export async function togglePromoCodeAction(
  promoId: string,
  eventId: string,
): Promise<void> {
  const ownership = await requireEventOwnership(eventId)
  if (!ownership.ok) redirect(ownership.redirectTo)

  const [row] = await db
    .select({ id: promoCodes.id, active: promoCodes.active })
    .from(promoCodes)
    .where(and(eq(promoCodes.id, promoId), eq(promoCodes.eventId, eventId)))
    .limit(1)
  if (!row) return

  await db
    .update(promoCodes)
    .set({ active: !row.active })
    .where(and(eq(promoCodes.id, promoId), eq(promoCodes.eventId, eventId)))

  revalidatePath(`/organizer/events/${eventId}/promos`)
}

export async function deletePromoCodeAction(
  promoId: string,
  eventId: string,
): Promise<void> {
  const ownership = await requireEventOwnership(eventId)
  if (!ownership.ok) redirect(ownership.redirectTo)

  await db.delete(promoCodes).where(and(eq(promoCodes.id, promoId), eq(promoCodes.eventId, eventId)))
  revalidatePath(`/organizer/events/${eventId}/promos`)
}
