"use server"

import { auth } from "@/auth"
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

function isValidWhatsappContact(value: string) {
  const compact = value.replace(/[\s()-]/g, "")
  return /^(\+?263|0)?7[1789]\d{7}$/.test(compact)
}

export async function saveOrganizerProfileAction(formData: FormData) {
  const session = await auth()
  if (!session?.user?.id) redirect("/auth/signin")

  const bio = ((formData.get("bio") as string) ?? "").trim().slice(0, 280)
  const phone = ((formData.get("whatsappContact") as string) ?? "").trim()
  const rawSlug = ((formData.get("organizerSlug") as string) ?? "").trim()
  const organizerSlug = rawSlug ? slugify(rawSlug) : slugify(session.user.name ?? session.user.email ?? session.user.id)
  if (!isValidWhatsappContact(phone)) {
    redirect("/organizer/onboarding?step=2&error=whatsapp_required")
  }

  try {
    await db
      .update(users)
      .set({ organizerBio: bio || null, organizerSlug, phone, updatedAt: new Date() })
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
