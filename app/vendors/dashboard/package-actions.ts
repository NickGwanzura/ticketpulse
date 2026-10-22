"use server"

import { z } from "zod"
import { and, eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"

import { auth } from "@/auth"
import { db } from "@/db"
import { vendors, vendorPackages } from "@/db/schema"
import { adminEmail, sendEmail } from "@/lib/email"

const PackageSchema = z.object({
  name: z.string().trim().min(2, "Name is too short").max(100),
  description: z.string().trim().max(500).nullable(),
  price: z.coerce.number().finite().positive("Enter a price greater than 0"),
  inclusions: z.array(z.string().trim().min(1).max(100)).max(12),
})

type Result = { ok: true; reviewRequired: boolean } | { ok: false; error: string }

async function currentVendor() {
  const session = await auth()
  if (!session?.user?.id) return null
  const [vendor] = await db.select({ id: vendors.id, verified: vendors.verified, businessName: vendors.businessName }).from(vendors).where(eq(vendors.userId, session.user.id)).limit(1)
  return vendor ?? null
}

async function notifyReview(businessName: string) {
  await sendEmail({
    to: adminEmail,
    subject: `Vendor packages awaiting review: ${businessName}`,
    text: `${businessName} changed their service packages. Review in /admin/vendors?status=pending.`,
    html: `<p>A vendor changed their service packages. Review the pending vendor queue.</p>`,
  }).catch((error) => console.error("[vendors] package review notification failed", error))
}

export async function createVendorPackage(input: unknown): Promise<Result> {
  const vendor = await currentVendor()
  if (!vendor) return { ok: false, error: "Only signed-in vendors can manage packages." }
  const parsed = PackageSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid package" }

  await db.transaction(async (tx) => {
    if (vendor.verified) await tx.update(vendors).set({ verified: false, rejectedAt: null }).where(eq(vendors.id, vendor.id))
    await tx.insert(vendorPackages).values({
      vendorId: vendor.id,
      name: parsed.data.name,
      description: parsed.data.description,
      price: parsed.data.price.toFixed(2),
      inclusions: parsed.data.inclusions,
    })
  })
  if (vendor.verified) await notifyReview(vendor.businessName)
  revalidatePath("/vendors/dashboard")
  revalidatePath("/vendors")
  revalidatePath(`/vendors/${vendor.id}`)
  return { ok: true, reviewRequired: !!vendor.verified }
}

export async function deleteVendorPackage(packageId: string): Promise<Result> {
  const vendor = await currentVendor()
  if (!vendor) return { ok: false, error: "Only signed-in vendors can manage packages." }
  if (!z.uuid().safeParse(packageId).success) return { ok: false, error: "Invalid package" }
  const deleted = await db.transaction(async (tx) => {
    const rows = await tx.delete(vendorPackages).where(and(eq(vendorPackages.id, packageId), eq(vendorPackages.vendorId, vendor.id))).returning({ id: vendorPackages.id })
    if (rows.length > 0 && vendor.verified) await tx.update(vendors).set({ verified: false, rejectedAt: null }).where(eq(vendors.id, vendor.id))
    return rows.length > 0
  })
  if (deleted && vendor.verified) await notifyReview(vendor.businessName)
  revalidatePath("/vendors/dashboard")
  revalidatePath("/vendors")
  revalidatePath(`/vendors/${vendor.id}`)
  return { ok: true, reviewRequired: deleted && !!vendor.verified }
}
