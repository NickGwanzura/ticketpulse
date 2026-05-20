"use server"

import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { eq, and } from "drizzle-orm"
import { z } from "zod"

import { auth } from "@/auth"
import { db } from "@/db"
import { events, vendorListings } from "@/db/schema"

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

const AddListingSchema = z.object({
  eventId:           z.uuid(),
  vendorId:          z.uuid(),
  packageName:       z.string().trim().min(1, "Package name is required").max(160),
  packageDescription: z.string().trim().max(2000).optional(),
  price:             z.string().min(1, "Price is required"),
  currency:          z.string().trim().min(1).max(8).default("USD"),
  maxCapacity:       z.string().optional(),
})

export type VendorListingFormState = {
  ok: boolean
  error?: string
  message?: string
  fieldErrors?: Record<string, string>
}

export async function addVendorListingAction(
  _prev: VendorListingFormState,
  formData: FormData,
): Promise<VendorListingFormState> {
  const raw = {
    eventId:           formData.get("eventId")?.toString() ?? "",
    vendorId:          formData.get("vendorId")?.toString() ?? "",
    packageName:       formData.get("packageName")?.toString() ?? "",
    packageDescription: formData.get("packageDescription")?.toString() ?? undefined,
    price:             formData.get("price")?.toString() ?? "",
    currency:          formData.get("currency")?.toString() || "USD",
    maxCapacity:       formData.get("maxCapacity")?.toString() ?? undefined,
  }

  const parsed = AddListingSchema.safeParse(raw)
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

  const maxCapacity = data.maxCapacity ? Number.parseInt(data.maxCapacity, 10) : null
  if (maxCapacity !== null && (Number.isNaN(maxCapacity) || maxCapacity < 1)) {
    return { ok: false, error: "Invalid max capacity.", fieldErrors: { maxCapacity: "Must be 1 or more" } }
  }

  await db.insert(vendorListings).values({
    eventId:        data.eventId,
    vendorId:       data.vendorId,
    packageName:    data.packageName,
    packageDescription: data.packageDescription || null,
    price:          price.toFixed(2),
    currency:       data.currency,
    maxCapacity,
    available:      true,
    booked:         false,
  })

  revalidatePath(`/organizer/events/${data.eventId}/vendors`)
  return { ok: true, message: "Vendor listing added." }
}

const UpdateListingSchema = z.object({
  listingId:         z.uuid(),
  eventId:           z.uuid(),
  packageName:       z.string().trim().min(1, "Package name is required").max(160),
  packageDescription: z.string().trim().max(2000).optional(),
  price:             z.string().min(1, "Price is required"),
  currency:          z.string().trim().min(1).max(8).default("USD"),
  maxCapacity:       z.string().optional(),
  available:         z.string().optional(),
})

export async function updateVendorListingAction(
  _prev: VendorListingFormState,
  formData: FormData,
): Promise<VendorListingFormState> {
  const raw = {
    listingId:          formData.get("listingId")?.toString() ?? "",
    eventId:            formData.get("eventId")?.toString() ?? "",
    packageName:        formData.get("packageName")?.toString() ?? "",
    packageDescription: formData.get("packageDescription")?.toString() ?? undefined,
    price:              formData.get("price")?.toString() ?? "",
    currency:           formData.get("currency")?.toString() || "USD",
    maxCapacity:        formData.get("maxCapacity")?.toString() ?? undefined,
    available:          formData.get("available")?.toString() ?? undefined,
  }

  const parsed = UpdateListingSchema.safeParse(raw)
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

  const maxCapacity = data.maxCapacity ? Number.parseInt(data.maxCapacity, 10) : null
  if (maxCapacity !== null && (Number.isNaN(maxCapacity) || maxCapacity < 1)) {
    return { ok: false, error: "Invalid max capacity.", fieldErrors: { maxCapacity: "Must be 1 or more" } }
  }

  const available = data.available === "on" || data.available === "true"

  await db
    .update(vendorListings)
    .set({
      packageName: data.packageName,
      packageDescription: data.packageDescription || null,
      price: price.toFixed(2),
      currency: data.currency,
      maxCapacity,
      available,
    })
    .where(and(
      eq(vendorListings.id, data.listingId),
      eq(vendorListings.eventId, data.eventId),
    ))

  revalidatePath(`/organizer/events/${data.eventId}/vendors`)
  return { ok: true, message: "Vendor listing updated." }
}

export async function removeVendorListingAction(formData: FormData): Promise<void> {
  const listingId = formData.get("listingId")?.toString()
  const eventId = formData.get("eventId")?.toString()
  if (!listingId || !eventId) return

  const guard = await requireEventOwnership(eventId)
  if (!guard.ok) redirect(guard.redirectTo)

  await db
    .delete(vendorListings)
    .where(and(
      eq(vendorListings.id, listingId),
      eq(vendorListings.eventId, eventId),
    ))

  revalidatePath(`/organizer/events/${eventId}/vendors`)
}

export async function toggleVendorListingAvailableAction(formData: FormData): Promise<void> {
  const listingId = formData.get("listingId")?.toString()
  const eventId = formData.get("eventId")?.toString()
  const next = formData.get("next")?.toString() === "true"
  if (!listingId || !eventId) return

  const guard = await requireEventOwnership(eventId)
  if (!guard.ok) redirect(guard.redirectTo)

  await db
    .update(vendorListings)
    .set({ available: next })
    .where(and(
      eq(vendorListings.id, listingId),
      eq(vendorListings.eventId, eventId),
    ))

  revalidatePath(`/organizer/events/${eventId}/vendors`)
}
