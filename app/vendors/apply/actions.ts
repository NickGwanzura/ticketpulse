"use server"

import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { eq } from "drizzle-orm"
import { z } from "zod"

import { auth } from "@/auth"
import { db } from "@/db"
import { users, vendors } from "@/db/schema"
import { adminEmail, sendEmail } from "@/lib/email"

const VENDOR_CATEGORIES = [
  "catering",
  "bar",
  "food_truck",
  "photography",
  "sound",
  "security",
  "decor",
  "other",
] as const

const VendorApplySchema = z.object({
  businessName: z.string().trim().min(2).max(120),
  category: z.enum(VENDOR_CATEGORIES),
  city: z.string().trim().min(2).max(80),
  phone: z.string().trim().min(5).max(40),
  email: z.email().max(120),
  description: z.string().trim().min(30).max(2000),
  portfolioLink: z.union([z.literal(""), z.url().max(500)]).transform((value) => value.trim()),
  terms: z.literal("on"),
})

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

export async function applyVendorAction(formData: FormData) {
  const session = await auth()
  if (!session?.user?.id) {
    redirect("/auth/signup?role=vendor&callbackUrl=/vendors/apply")
  }

  const parsed = VendorApplySchema.safeParse({
    businessName: formData.get("businessName"),
    category: formData.get("category"),
    city: formData.get("city"),
    phone: formData.get("phone"),
    email: formData.get("email"),
    description: formData.get("description"),
    portfolioLink: formData.get("portfolioLink") ?? "",
    terms: formData.get("terms"),
  })

  if (!parsed.success) {
    redirect("/vendors/apply?error=invalid")
  }

  const data = parsed.data
  const portfolio = data.portfolioLink ? [data.portfolioLink] : []

  const [existingVendor] = await db
    .select({ id: vendors.id })
    .from(vendors)
    .where(eq(vendors.userId, session.user.id))
    .limit(1)

  let vendorId = existingVendor?.id

  if (existingVendor) {
    await db
      .update(vendors)
      .set({
        businessName: data.businessName,
        category: data.category,
        city: data.city,
        phone: data.phone,
        email: data.email,
        description: data.description,
        portfolio,
      })
      .where(eq(vendors.id, existingVendor.id))
  } else {
    const [created] = await db.insert(vendors).values({
      userId: session.user.id,
      businessName: data.businessName,
      category: data.category,
      city: data.city,
      phone: data.phone,
      email: data.email,
      description: data.description,
      portfolio,
      verified: false,
    }).returning({ id: vendors.id })
    vendorId = created.id
  }

  if (session.user.role === "attendee") {
    await db
      .update(users)
      .set({ role: "vendor", updatedAt: new Date() })
      .where(eq(users.id, session.user.id))
  }

  await sendEmail({
    to: adminEmail,
    subject: `New vendor application: ${data.businessName}`,
    text: [
      `Business: ${data.businessName}`,
      `Category: ${data.category}`,
      `City: ${data.city}`,
      `Phone: ${data.phone}`,
      `Email: ${data.email}`,
      `Applicant: ${session.user.email ?? session.user.id}`,
      `Profile: /vendors/${vendorId}`,
    ].join("\n"),
    html: `
      <p><strong>New vendor application</strong></p>
      <p><strong>Business:</strong> ${escapeHtml(data.businessName)}</p>
      <p><strong>Category:</strong> ${escapeHtml(data.category)}</p>
      <p><strong>City:</strong> ${escapeHtml(data.city)}</p>
      <p><strong>Phone:</strong> ${escapeHtml(data.phone)}</p>
      <p><strong>Email:</strong> ${escapeHtml(data.email)}</p>
      <p><strong>Applicant:</strong> ${escapeHtml(session.user.email ?? session.user.id)}</p>
      <p><strong>Profile:</strong> /vendors/${escapeHtml(vendorId ?? "")}</p>
    `,
  }).catch((error) => {
    console.error("[vendors] failed to send vendor application email", error)
  })

  revalidatePath("/vendors")
  revalidatePath(`/vendors/${vendorId}`)
  revalidatePath("/vendors/dashboard")
  redirect("/vendors/dashboard?applied=1")
}
