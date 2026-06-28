"use server"

import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { eq } from "drizzle-orm"
import { db } from "@/db"
import { users } from "@/db/schema"

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
  const rawSlug = ((formData.get("organizerSlug") as string) ?? "").trim()
  const organizerSlug = rawSlug ? slugify(rawSlug) : slugify(session.user.name ?? session.user.email ?? session.user.id)

  try {
    await db
      .update(users)
      .set({ organizerBio: bio || null, organizerSlug, updatedAt: new Date() })
      .where(eq(users.id, session.user.id))
  } catch {
    redirect("/organizer/onboarding?step=2&error=slug_taken")
  }

  redirect("/organizer/onboarding?step=3")
}
