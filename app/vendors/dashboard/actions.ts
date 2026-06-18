"use server"

import { z } from "zod"
import { eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"

import { auth } from "@/auth"
import { db } from "@/db"
import { vendors } from "@/db/schema"

// ─── Validation ──────────────────────────────────────────────────────────────
// URL fields are produced by our presign endpoint, which already enforces
// ownership. We validate that they're well-formed URLs and, if the public
// base is configured, that they originate from it. We don't fail loudly when
// the env is missing — the source of truth is the presign endpoint's
// ownership check.

const PUBLIC_BASE = (process.env.NEXT_PUBLIC_R2_PUBLIC_URL ?? "").replace(/\/+$/, "")

const urlField = z
  .url({ message: "Must be a valid URL" })
  .refine(
    (value) => (PUBLIC_BASE ? value.startsWith(`${PUBLIC_BASE}/`) : true),
    { message: "URL must come from the upload service" },
  )

const emailField = z
  .union([z.literal(""), z.email({ message: "Enter a valid email" }).max(120)])
  .transform((value) => (value === "" ? null : value))

const InputSchema = z.object({
  businessName: z.string().trim().min(2, "Business name is too short").max(120),
  description:  z.string().trim().max(2000).nullable(),
  phone:        z.string().trim().max(40).nullable(),
  email:        emailField.nullable(),
  city:         z.string().trim().max(80).nullable(),
  priceRange:   z.string().trim().max(60).nullable(),
  logo:         urlField.nullable(),
  portfolio:    z.array(urlField).max(12),
})

export type UpdateVendorInput = z.input<typeof InputSchema>

export type UpdateVendorResult =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: Record<string, string[] | undefined> }

export async function updateVendorProfile(
  input: UpdateVendorInput,
): Promise<UpdateVendorResult> {
  const session = await auth()
  if (!session?.user?.id) {
    return { ok: false, error: "Unauthenticated" }
  }
  const userId = session.user.id
  const isAdmin = session.user.role === "admin"

  // Only vendors and admins can manage vendor profiles
  if (session.user.role !== "vendor" && !isAdmin) {
    return { ok: false, error: "Only vendors can manage vendor profiles." }
  }

  const parsed = InputSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      error: "Invalid input",
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
    }
  }

  // Look up vendor by userId (each user has at most one vendor row).
  const [vendor] = await db
    .select({ id: vendors.id, userId: vendors.userId })
    .from(vendors)
    .where(eq(vendors.userId, userId))
    .limit(1)

  if (!vendor) {
    return { ok: false, error: "Vendor profile not found" }
  }
  if (vendor.userId !== userId && !isAdmin) {
    return { ok: false, error: "Forbidden" }
  }

  const data = parsed.data

  await db
    .update(vendors)
    .set({
      businessName: data.businessName,
      description:  data.description,
      phone:        data.phone,
      email:        data.email,
      city:         data.city,
      priceRange:   data.priceRange,
      logo:         data.logo,
      portfolio:    data.portfolio,
    })
    .where(eq(vendors.id, vendor.id))

  revalidatePath("/vendors/dashboard")
  return { ok: true }
}
