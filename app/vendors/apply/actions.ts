"use server"

import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { eq } from "drizzle-orm"
import { z } from "zod"

import { auth } from "@/auth"
import { db } from "@/db"
import { users, vendors } from "@/db/schema"
import { log } from "@/lib/logger"
import { adminEmail, sendEmail } from "@/lib/email"
import { sendVendorEmailVerification } from "@/lib/vendor-email-verification"

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
  description: z.string().trim().max(2000),
  portfolioLink: z.union([z.literal(""), z.url().max(500).refine((value) => /^https?:\/\//i.test(value), "Use an HTTP or HTTPS link")]).transform((value) => value.trim()),
  terms: z.literal("on"),
})

export type VendorApplyState = {
  error: string | null
  fieldErrors: Record<string, string[] | undefined>
}

export const initialVendorApplyState: VendorApplyState = { error: null, fieldErrors: {} }

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

export async function applyVendorAction(_state: VendorApplyState, formData: FormData): Promise<VendorApplyState> {
  const session = await auth()
  if (!session?.user?.id) {
    redirect("/auth/signin?callbackUrl=/vendors/apply")
  }

  // Only vendors, attendees, and admins can apply
  if (session.user.role !== "vendor" && session.user.role !== "attendee" && session.user.role !== "admin") {
    return { error: "This account cannot apply as a vendor.", fieldErrors: {} }
  }

  const [account] = await db.select({ email: users.email }).from(users).where(eq(users.id, session.user.id)).limit(1)
  if (!account?.email) return { error: "Add an email address to your account before applying.", fieldErrors: {} }

  const parsed = VendorApplySchema.safeParse({
    businessName: formData.get("businessName"),
    category: formData.get("category"),
    city: formData.get("city"),
    phone: formData.get("phone"),
    description: formData.get("description"),
    portfolioLink: formData.get("portfolioLink") ?? "",
    terms: formData.get("terms"),
  })

  if (!parsed.success) {
    const fieldErrors = z.flattenError(parsed.error).fieldErrors
    log.warn("vendors/apply — validation failed", {
      userId: session.user.id,
      fields: Object.keys(fieldErrors),
    })
    return {
      error: "Please correct the highlighted fields and submit again.",
      fieldErrors,
    }
  }

  const data = parsed.data

  let vendorId: string | undefined
  try {
    const [existingVendor] = await db
      .select({ id: vendors.id, portfolio: vendors.portfolio })
      .from(vendors)
      .where(eq(vendors.userId, session.user.id))
      .limit(1)

    const existingPortfolio = Array.isArray(existingVendor?.portfolio) ? existingVendor.portfolio : []
    const portfolio = data.portfolioLink
      ? [data.portfolioLink, ...existingPortfolio.filter((url) => url !== data.portfolioLink)].slice(0, 12)
      : existingPortfolio

    vendorId = existingVendor?.id
    if (existingVendor) {
      await db
        .update(vendors)
        .set({
          businessName: data.businessName,
          category: data.category,
          city: data.city,
          phone: data.phone,
          email: account.email,
          description: data.description || null,
          portfolio,
          verified: false,
          rejectedAt: null,
        })
        .where(eq(vendors.id, existingVendor.id))
    } else {
      const [created] = await db.insert(vendors).values({
        userId: session.user.id,
        businessName: data.businessName,
        category: data.category,
        city: data.city,
        phone: data.phone,
        email: account.email,
        description: data.description || null,
        portfolio,
        verified: false,
      }).returning({ id: vendors.id })
      vendorId = created?.id
      if (!vendorId) throw new Error("Vendor application insert returned no row")
    }

    if (session.user.role === "attendee") {
      await db
        .update(users)
        .set({ role: "vendor", updatedAt: new Date() })
        .where(eq(users.id, session.user.id))
    }
  } catch (error) {
    log.error("vendors/apply — application save failed", { userId: session.user.id, error: String(error) })
    return { error: "We couldn't save your application. Your details are still here; please try again.", fieldErrors: {} }
  }

  log.info("vendors/apply — application saved", { userId: session.user.id, vendorId, category: data.category })

  await sendVendorEmailVerification(session.user.id).catch((error) => {
    log.error("vendors/apply — verification email failed", { error: String(error) })
  })

  await sendEmail({
    to: adminEmail,
    subject: `New vendor application: ${data.businessName}`,
    text: [
      `Business: ${data.businessName}`,
      `Category: ${data.category}`,
      `City: ${data.city}`,
      `Phone: ${data.phone}`,
      `Email: ${account.email}`,
      `Applicant: ${session.user.email ?? session.user.id}`,
      `Profile: /vendors/${vendorId}`,
    ].join("\n"),
    html: `
      <p><strong>New vendor application</strong></p>
      <p><strong>Business:</strong> ${escapeHtml(data.businessName)}</p>
      <p><strong>Category:</strong> ${escapeHtml(data.category)}</p>
      <p><strong>City:</strong> ${escapeHtml(data.city)}</p>
      <p><strong>Phone:</strong> ${escapeHtml(data.phone)}</p>
      <p><strong>Email:</strong> ${escapeHtml(account.email)}</p>
      <p><strong>Applicant:</strong> ${escapeHtml(session.user.email ?? session.user.id)}</p>
      <p><strong>Profile:</strong> /vendors/${escapeHtml(vendorId ?? "")}</p>
    `,
  }).catch((error) => {
    console.error("[vendors] failed to send vendor application email", error)
    log.error("vendors/apply — admin notification email failed", { error: String(error) })
  })

  revalidatePath("/vendors")
  revalidatePath(`/vendors/${vendorId}`)
  revalidatePath("/vendors/dashboard")
  redirect("/vendors/dashboard?applied=1")
}
