"use server"

import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { eq, and } from "drizzle-orm"
import { z } from "zod"

import { auth } from "@/auth"
import { db } from "@/db"
import { events, merchItems } from "@/db/schema"
import { requireEventAccessForUser } from "@/lib/event-access"

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
  // Shared rule: owner, invited co-organiser, or admin; frozen accounts blocked.
  if (!(await requireEventAccessForUser(row.id, session.user)).allowed) {
    return { ok: false as const, redirectTo: "/organizer" }
  }
  return { ok: true as const, session, event: row }
}

async function requireMerchOwnership(merchId: string) {
  const session = await auth()
  if (!session?.user?.id) {
    return { ok: false as const, redirectTo: "/auth/signin" }
  }
  const [row] = await db
    .select({
      id: merchItems.id,
      eventId: merchItems.eventId,
      organizerId: merchItems.organizerId,
    })
    .from(merchItems)
    .where(eq(merchItems.id, merchId))
    .limit(1)
  if (!row) return { ok: false as const, redirectTo: "/organizer" }
  // Shared rule: owner, invited co-organiser, or admin; frozen accounts blocked.
  if (!(await requireEventAccessForUser(row.eventId, session.user)).allowed) {
    return { ok: false as const, redirectTo: "/organizer" }
  }
  return { ok: true as const, session, merch: row }
}

const SaveSchema = z.object({
  eventId:           z.uuid(),
  merchId:           z.uuid().optional(),
  name:              z.string().trim().min(1, "Name is required").max(160),
  description:       z.string().trim().max(2000).optional(),
  price:             z.string().min(1, "Price is required"),
  currency:          z.string().trim().min(1).max(8).default("USD"),
  images:            z.string().optional(),
  sizes:             z.string().optional(),
  colors:            z.string().optional(),
  stockQuantity:     z.string().optional(),
  active:            z.string().optional(),
  deliveryAvailable: z.string().optional(),
  pickupAtEvent:     z.string().optional(),
})

export type MerchFormState = {
  ok: boolean
  error?: string
  message?: string
  fieldErrors?: Record<string, string>
}

function csvList(input?: string, max = 20): string[] {
  if (!input) return []
  return input.split(",").map((s) => s.trim()).filter(Boolean).slice(0, max)
}

export async function saveMerchAction(
  _prev: MerchFormState,
  formData: FormData,
): Promise<MerchFormState> {
  const raw = {
    eventId:           formData.get("eventId")?.toString() ?? "",
    merchId:           formData.get("merchId")?.toString() || undefined,
    name:              formData.get("name")?.toString() ?? "",
    description:       formData.get("description")?.toString() ?? undefined,
    price:             formData.get("price")?.toString() ?? "",
    currency:          formData.get("currency")?.toString() || "USD",
    images:            formData.get("images")?.toString() ?? undefined,
    sizes:             formData.get("sizes")?.toString() ?? undefined,
    colors:            formData.get("colors")?.toString() ?? undefined,
    stockQuantity:     formData.get("stockQuantity")?.toString() ?? undefined,
    active:            formData.get("active")?.toString() ?? undefined,
    deliveryAvailable: formData.get("deliveryAvailable")?.toString() ?? undefined,
    pickupAtEvent:     formData.get("pickupAtEvent")?.toString() ?? undefined,
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
    return { ok: false, error: "Invalid price.", fieldErrors: { price: "Must be a positive number" } }
  }

  const stock = data.stockQuantity ? Number.parseInt(data.stockQuantity, 10) : 0
  if (Number.isNaN(stock) || stock < 0) {
    return { ok: false, error: "Invalid stock quantity.", fieldErrors: { stockQuantity: "Must be 0 or more" } }
  }

  // images is a JSON-encoded array (set by the client form) so the order is preserved.
  let images: string[] = []
  if (data.images) {
    try {
      const candidate = JSON.parse(data.images)
      if (Array.isArray(candidate)) {
        images = candidate
          .filter((v): v is string => typeof v === "string" && v.startsWith("http"))
          .slice(0, 8)
      }
    } catch { /* ignore */ }
  }

  const sizes  = csvList(data.sizes, 20)
  const colors = csvList(data.colors, 20)

  const active            = data.active === "on" || data.active === "true"
  const deliveryAvailable = data.deliveryAvailable === "on" || data.deliveryAvailable === "true"
  const pickupAtEvent     = data.pickupAtEvent === "on" || data.pickupAtEvent === "true"

  if (data.merchId) {
    const ownerCheck = await requireMerchOwnership(data.merchId)
    if (!ownerCheck.ok || ownerCheck.merch.eventId !== data.eventId) {
      return { ok: false, error: "Not allowed." }
    }
    await db
      .update(merchItems)
      .set({
        name:              data.name,
        description:       data.description || null,
        price:             price.toFixed(2),
        currency:          data.currency,
        images,
        sizes,
        colors,
        stockQuantity:     stock,
        active,
        deliveryAvailable,
        pickupAtEvent,
      })
      .where(eq(merchItems.id, data.merchId))
  } else {
    await db.insert(merchItems).values({
      eventId:           data.eventId,
      organizerId:       guard.session.user.id,
      name:              data.name,
      description:       data.description || null,
      price:             price.toFixed(2),
      currency:          data.currency,
      images,
      sizes,
      colors,
      stockQuantity:     stock,
      active,
      deliveryAvailable,
      pickupAtEvent,
    })
  }

  revalidatePath(`/organizer/events/${data.eventId}/merch`)
  return { ok: true, message: "Saved." }
}

export async function deleteMerchAction(formData: FormData): Promise<void> {
  const merchId = formData.get("merchId")?.toString()
  const eventId = formData.get("eventId")?.toString()
  if (!merchId || !eventId) return

  const guard = await requireMerchOwnership(merchId)
  if (!guard.ok) redirect(guard.redirectTo)

  await db.delete(merchItems).where(eq(merchItems.id, merchId))
  revalidatePath(`/organizer/events/${eventId}/merch`)
}

export async function toggleMerchActiveAction(formData: FormData): Promise<void> {
  const merchId = formData.get("merchId")?.toString()
  const eventId = formData.get("eventId")?.toString()
  const next = formData.get("next")?.toString() === "true"
  if (!merchId || !eventId) return

  const guard = await requireMerchOwnership(merchId)
  if (!guard.ok) redirect(guard.redirectTo)

  await db
    .update(merchItems)
    .set({ active: next })
    .where(and(eq(merchItems.id, merchId), eq(merchItems.eventId, eventId)))
  revalidatePath(`/organizer/events/${eventId}/merch`)
}
