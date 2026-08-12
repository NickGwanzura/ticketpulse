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

/**
 * Read approval state from the database at mutation time. JWT approval data is
 * intentionally not trusted here because it can be up to five minutes stale.
 */
export async function requireApprovedOrganizer(): Promise<OrganizerEligibility> {
  // `auth` is overloaded for both request middleware and server sessions in
  // NextAuth v5; narrow it explicitly at this server-only call site.
  const session = await (auth as unknown as () => Promise<AuthenticatedSession | null>)()
  if (!session?.user?.id) return { ok: false, error: "You must be signed in." }

  const [user] = await db
    .select({ role: users.role, approvedAt: users.approvedAt, emailVerified: users.emailVerified })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1)

  if (user?.role === "admin") return { ok: true, session }
  if (user?.role !== "organizer") {
    return { ok: false, error: "Only organizers can create events." }
  }

  if (!user?.emailVerified) {
    return { ok: false, error: "Verify your email before creating an event." }
  }
  if (!user.approvedAt) {
    return { ok: false, error: "Your organizer account is pending approval." }
  }

  return { ok: true, session }
}
