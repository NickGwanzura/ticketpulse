"use server"

import { z } from "zod"
import { and, eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"

import { auth } from "@/auth"
import { db } from "@/db"
import { vendors, vendorPackages } from "@/db/schema"

const PackageSchema = z.object({
  name: z.string().trim().min(2, "Name is too short").max(100),
  description: z.string().trim().max(500).nullable(),
  price: z.coerce.number().finite().positive("Enter a price greater than 0"),
  inclusions: z.array(z.string().trim().min(1).max(100)).max(12),
})

type Result = { ok: true } | { ok: false; error: string }

async function currentVendor() {
  const session = await auth()
  if (!session?.user?.id || session.user.role !== "vendor") return null
  const [vendor] = await db.select({ id: vendors.id }).from(vendors).where(eq(vendors.userId, session.user.id)).limit(1)
  return vendor ?? null
}

export async function createVendorPackage(input: unknown): Promise<Result> {
  const vendor = await currentVendor()
  if (!vendor) return { ok: false, error: "Only signed-in vendors can manage packages." }
  const parsed = PackageSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid package" }

  await db.insert(vendorPackages).values({
    vendorId: vendor.id,
    name: parsed.data.name,
    description: parsed.data.description,
    price: parsed.data.price.toFixed(2),
    inclusions: parsed.data.inclusions,
  })
  revalidatePath("/vendors/dashboard")
  revalidatePath("/vendors")
  return { ok: true }
}

export async function deleteVendorPackage(packageId: string): Promise<Result> {
  const vendor = await currentVendor()
  if (!vendor) return { ok: false, error: "Only signed-in vendors can manage packages." }
  if (!z.uuid().safeParse(packageId).success) return { ok: false, error: "Invalid package" }
  await db.delete(vendorPackages).where(and(eq(vendorPackages.id, packageId), eq(vendorPackages.vendorId, vendor.id)))
  revalidatePath("/vendors/dashboard")
  return { ok: true }
}
