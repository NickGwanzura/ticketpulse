"use server"

import { eq } from "drizzle-orm"
import { auth } from "@/auth"
import { db } from "@/db"
import { vendors } from "@/db/schema"
import { sendVendorEmailVerification } from "@/lib/vendor-email-verification"

export async function requestVendorEmailVerification(): Promise<{ ok: boolean; message: string }> {
  const session = await auth()
  if (!session?.user?.id) return { ok: false, message: "Sign in first." }
  const [vendor] = await db.select({ id: vendors.id }).from(vendors).where(eq(vendors.userId, session.user.id)).limit(1)
  if (!vendor) return { ok: false, message: "Vendor application not found." }
  try {
    const result = await sendVendorEmailVerification(session.user.id)
    if (result === "sent") return { ok: true, message: "Verification email sent. Check your inbox." }
    if (result === "verified") return { ok: true, message: "Your email is already verified." }
    if (result === "limited") return { ok: false, message: "Please wait before requesting another email." }
    return { ok: false, message: "Add an email to your account first." }
  } catch (error) {
    console.error("[vendors] verification email failed", error)
    return { ok: false, message: "We couldn't send the email. Try again shortly." }
  }
}
