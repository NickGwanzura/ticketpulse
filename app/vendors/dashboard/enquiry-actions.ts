"use server"

import { z } from "zod"
import { and, eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"

import { auth } from "@/auth"
import { db } from "@/db"
import { vendors, vendorEnquiries } from "@/db/schema"

const StatusSchema = z.enum(["new", "contacted", "quoted", "accepted", "declined", "closed"])

export async function updateVendorEnquiryStatus(enquiryId: string, status: string) {
  const session = await auth()
  if (!session?.user?.id || session.user.role !== "vendor") return { ok: false, error: "Only signed-in vendors can update enquiries." }
  const parsedId = z.uuid().safeParse(enquiryId)
  const parsedStatus = StatusSchema.safeParse(status)
  if (!parsedId.success || !parsedStatus.success) return { ok: false, error: "Invalid enquiry update." }

  const [vendor] = await db.select({ id: vendors.id }).from(vendors).where(eq(vendors.userId, session.user.id)).limit(1)
  if (!vendor) return { ok: false, error: "Vendor profile not found." }

  await db.update(vendorEnquiries).set({ status: parsedStatus.data, updatedAt: new Date() }).where(and(eq(vendorEnquiries.id, enquiryId), eq(vendorEnquiries.vendorId, vendor.id)))
  revalidatePath("/vendors/dashboard")
  return { ok: true }
}
