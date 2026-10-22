"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { eq } from "drizzle-orm"

import { auth } from "@/auth"
import { db } from "@/db"
import { users, vendors } from "@/db/schema"
import { sendEmail } from "@/lib/email"
import { vendorApprovedEmail, vendorDeclinedEmail } from "@/lib/email-templates"

async function requireAdmin() {
  const session = await auth()
  if (!session?.user || session.user.role !== "admin") redirect("/auth/signin?callbackUrl=/admin/vendors")
}

export async function approveVendorAction(vendorId: string) {
  await requireAdmin()

  const [vendor] = await db
    .select({ businessName: vendors.businessName, email: vendors.email, verified: vendors.verified, userId: vendors.userId })
    .from(vendors)
    .where(eq(vendors.id, vendorId))
    .limit(1)

  if (!vendor?.userId) redirect("/admin/vendors?error=unverified")
  const [account] = await db.select({ email: users.email, emailVerified: users.emailVerified })
    .from(users).where(eq(users.id, vendor.userId)).limit(1)
  if (!account?.emailVerified || !account.email || account.email.toLowerCase() !== vendor.email?.toLowerCase()) {
    redirect("/admin/vendors?error=unverified")
  }

  await db
    .update(vendors)
    .set({ verified: true, rejectedAt: null })
    .where(eq(vendors.id, vendorId))

  if (vendor.email && !vendor.verified) {
    const tpl = vendorApprovedEmail({ businessName: vendor.businessName })
    sendEmail({
      to: vendor.email,
      subject: "You're verified — your listing is live on TicketPulse",
      html: tpl.html,
      text: tpl.text,
    }).catch((error) => {
      console.error("[admin] vendor approval email failed", error)
    })
  }

  revalidatePath("/admin/vendors")
  revalidatePath("/vendors")
  revalidatePath(`/vendors/${vendorId}`)
}

export async function rejectVendorAction(vendorId: string) {
  await requireAdmin()

  const [vendor] = await db
    .select({ businessName: vendors.businessName, email: vendors.email, verified: vendors.verified })
    .from(vendors)
    .where(eq(vendors.id, vendorId))
    .limit(1)

  const wasVerified = !!vendor?.verified

  await db
    .update(vendors)
    .set({ verified: false, rejectedAt: new Date() })
    .where(eq(vendors.id, vendorId))

  if (vendor?.email) {
    const tpl = vendorDeclinedEmail({ businessName: vendor.businessName, wasVerified })
    sendEmail({
      to: vendor.email,
      subject: wasVerified ? "Your TicketPulse vendor verification was revoked" : "Update on your TicketPulse vendor application",
      html: tpl.html,
      text: tpl.text,
    }).catch((error) => {
      console.error("[admin] vendor rejection email failed", error)
    })
  }

  revalidatePath("/admin/vendors")
  revalidatePath("/vendors")
  revalidatePath(`/vendors/${vendorId}`)
}
