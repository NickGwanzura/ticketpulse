import "server-only"

import { eq } from "drizzle-orm"

import { auth } from "@/auth"
import { db } from "@/db"
import { users } from "@/db/schema"

type AuthenticatedSession = {
  user: {
    id: string
    role?: string | null
    name?: string | null
  }
}

export type OrganizerEligibility =
  | { ok: true; session: AuthenticatedSession }
  | { ok: false; error: string }

async function requireOrganizer({ requireApproval }: { requireApproval: boolean }): Promise<OrganizerEligibility> {
  const session = await (auth as unknown as () => Promise<AuthenticatedSession | null>)()
  if (!session?.user?.id) return { ok: false, error: "You must be signed in." }

  const [user] = await db
    .select({
      role: users.role,
      approvedAt: users.approvedAt,
      emailVerified: users.emailVerified,
      organizerFrozenAt: users.organizerFrozenAt,
    })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1)

  if (user?.role === "admin") return { ok: true, session }
  if (user?.role !== "organizer") {
    return { ok: false, error: "Only organizers can create events." }
  }
  if (user.organizerFrozenAt) {
    return { ok: false, error: "Your organizer account is temporarily frozen. Contact TicketPulse support." }
  }
  if (!user.emailVerified) {
    return { ok: false, error: "Verify your email before creating an event." }
  }
  if (requireApproval && !user.approvedAt) {
    return { ok: false, error: "Your organizer account is pending approval." }
  }

  return { ok: true, session }
}

/**
 * Allow a verified organizer to prepare draft events while account review is
 * pending. Approval is still required before an event can be submitted.
 */
export function requireOrganizerForDraft(): Promise<OrganizerEligibility> {
  return requireOrganizer({ requireApproval: false })
}

/**
 * Read approval state from the database at mutation time. JWT approval data is
 * intentionally not trusted here because it can be up to five minutes stale.
 */
export async function requireApprovedOrganizer(): Promise<OrganizerEligibility> {
  return requireOrganizer({ requireApproval: true })
}
