"use server"

import { z } from "zod"
import { eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"

import { auth } from "@/auth"
import { db } from "@/db"
import { users, vendors } from "@/db/schema"
import { adminEmail, sendEmail } from "@/lib/email"

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

const portfolioUrlField = z.url({ message: "Must be a valid URL" })
  .refine((value) => /^https?:\/\//i.test(value), { message: "Use an HTTP or HTTPS link" })

const InputSchema = z.object({
  businessName: z.string().trim().min(2, "Business name is too short").max(120),
  description:  z.string().trim().max(2000).nullable(),
  phone:        z.string().trim().max(40).nullable(),
  city:         z.string().trim().max(80).nullable(),
  priceRange:   z.string().trim().max(60).nullable(),
  logo:         urlField.nullable(),
  portfolio:    z.array(portfolioUrlField).max(12),
})

export type UpdateVendorInput = z.input<typeof InputSchema>

export type UpdateVendorResult =
  | { ok: true; reviewRequired: boolean }
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
    .select()
    .from(vendors)
    .where(eq(vendors.userId, userId))
    .limit(1)

  if (!vendor) {
    return { ok: false, error: "Vendor profile not found" }
  }
  if (vendor.userId !== userId && !isAdmin) {
    return { ok: false, error: "Forbidden" }
  }

  const [account] = await db.select({ email: users.email }).from(users).where(eq(users.id, userId)).limit(1)
  if (!account?.email) return { ok: false, error: "Your account needs an email address." }

  const data = parsed.data
  const reviewRequired = !!vendor.verified && (
    vendor.businessName !== data.businessName ||
    (vendor.description ?? null) !== data.description ||
    (vendor.phone ?? null) !== data.phone ||
    (vendor.city ?? null) !== data.city ||
    (vendor.priceRange ?? null) !== data.priceRange ||
    (vendor.logo ?? null) !== data.logo ||
    JSON.stringify(vendor.portfolio ?? []) !== JSON.stringify(data.portfolio) ||
    vendor.email?.toLowerCase() !== account.email.toLowerCase()
  )

  await db
    .update(vendors)
    .set({
      businessName: data.businessName,
      description:  data.description,
      phone:        data.phone,
      email:        account.email,
      city:         data.city,
      priceRange:   data.priceRange,
      logo:         data.logo,
      portfolio:    data.portfolio,
      ...(reviewRequired ? { verified: false, rejectedAt: null } : {}),
    })
    .where(eq(vendors.id, vendor.id))

  revalidatePath("/vendors/dashboard")
  if (reviewRequired) {
    revalidatePath("/vendors")
    revalidatePath(`/vendors/${vendor.id}`)
    await sendEmail({
      to: adminEmail,
      subject: `Vendor changes awaiting review: ${data.businessName}`,
      text: `Vendor ${data.businessName} updated a verified profile. Review it in /admin/vendors?status=pending.`,
      html: `<p>Vendor profile changes are awaiting review.</p><p>Vendor ID: ${vendor.id}</p><p>Review in the admin vendor queue.</p>`,
    }).catch((error) => console.error("[vendors] review notification failed", error))
  }
  return { ok: true, reviewRequired }
}
