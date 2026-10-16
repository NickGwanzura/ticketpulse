"use server"

import { auth } from "@/auth"
import { isValidWhatsappContact } from "@/lib/phone"
import { redirect } from "next/navigation"
import { eq } from "drizzle-orm"
import { db } from "@/db"
import { users } from "@/db/schema"
import { log } from "@/lib/logger"
import { trackOrganizerLifecycle } from "@/lib/organizer-lifecycle"

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 40)
}

export async function saveOrganizerProfileAction(formData: FormData) {
  const session = await auth()
  if (!session?.user?.id) redirect("/auth/signin")

  const bio = ((formData.get("bio") as string) ?? "").trim().slice(0, 280)
  const phone = ((formData.get("whatsappContact") as string) ?? "").trim()
  const rawSlug = ((formData.get("organizerSlug") as string) ?? "").trim()
  const organizerType = ((formData.get("organizerType") as string) ?? "").trim()
  const organizerEntityName = ((formData.get("organizerEntityName") as string) ?? "").trim().slice(0, 160)
  const organizerLocation = ((formData.get("organizerLocation") as string) ?? "").trim().slice(0, 120)
  const organizerReferenceUrl = ((formData.get("organizerReferenceUrl") as string) ?? "").trim().slice(0, 300)
  const organizerSlug = rawSlug ? slugify(rawSlug) : slugify(session.user.name ?? session.user.email ?? session.user.id)
  if (!isValidWhatsappContact(phone)) {
    redirect("/organizer/onboarding?step=2&error=whatsapp_required")
  }
  if (!["individual", "business", "community"].includes(organizerType) || organizerLocation.length < 2) {
    redirect("/organizer/onboarding?step=2&error=details_required")
  }
  if (organizerReferenceUrl) {
    try {
      const parsed = new URL(organizerReferenceUrl)
      if (parsed.protocol !== "https:" && parsed.protocol !== "http:") throw new Error("Invalid URL")
    } catch {
      redirect("/organizer/onboarding?step=2&error=invalid_url")
    }
  }

  try {
    await db
      .update(users)
      .set({
        organizerBio: bio || null,
        organizerSlug,
        phone,
        organizerType,
        organizerEntityName: organizerEntityName || null,
        organizerLocation,
        organizerReferenceUrl: organizerReferenceUrl || null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, session.user.id))

    await trackOrganizerLifecycle({
      step: "PROFILE_COMPLETED",
      organizerId: session.user.id,
      dedupeKey: `organizer:${session.user.id}:profile-completed`,
      source: "organizer_onboarding",
    })
  } catch (err: unknown) {
    console.error("[onboarding] saveOrganizerProfileAction", err)
    log.error("onboarding — saveOrganizerProfileAction failed", { userId: session.user.id, error: String(err) })
    // PostgreSQL unique violation code
    if (typeof err === "object" && err !== null && "code" in err && (err as { code: string }).code === "23505") {
      redirect("/organizer/onboarding?step=2&error=slug_taken")
    }
    redirect("/organizer/onboarding?step=2&error=generic")
  }

  redirect("/organizer/onboarding?step=3")
}
