import { redirect } from "next/navigation"
import { eq } from "drizzle-orm"

import { auth } from "@/auth"
import { db } from "@/db"
import { users } from "@/db/schema"

const ROLE_DESTINATIONS = {
  attendee: "/dashboard",
  organizer: "/organizer",
  vendor: "/vendors/apply",
} as const

type SignupRole = keyof typeof ROLE_DESTINATIONS

function localCallback(value: string | undefined): string | null {
  return value?.startsWith("/") && !value.startsWith("//") ? value : null
}

function normalizeRole(value: string | undefined): SignupRole {
  return value === "organizer" || value === "vendor" ? value : "attendee"
}

export default async function CompleteSignupPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string; callbackUrl?: string }>
}) {
  const session = await auth()
  const sp = await searchParams
  const requestedRole = normalizeRole(sp.role)
  const callbackUrl = localCallback(sp.callbackUrl)

  if (!session?.user?.id) {
    const params = new URLSearchParams({ role: requestedRole })
    if (callbackUrl) params.set("callbackUrl", callbackUrl)
    const completeUrl = `/auth/complete-signup?${params.toString()}`
    redirect(`/auth/signin?callbackUrl=${encodeURIComponent(completeUrl)}`)
  }

  if (requestedRole !== "attendee") {
    const [row] = await db
      .select({ role: users.role })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1)

    if (row?.role === "attendee") {
      await db
        .update(users)
        .set({ role: requestedRole, updatedAt: new Date() })
        .where(eq(users.id, session.user.id))
    }
  }

  redirect(callbackUrl ?? ROLE_DESTINATIONS[requestedRole])
}
