import "server-only"
import { auth } from "@/auth"

/**
 * The `if (!session?.user || session.user.role !== "admin") throw ...` guard
 * used to be copy-pasted at the top of ~40 server actions across the admin
 * surface. One missed copy in a new action ships an unauthenticated admin
 * endpoint — this makes the check impossible to forget instead of a
 * convention to remember.
 */
export async function requireAdmin() {
  const session = await auth()
  if (!session?.user || session.user.role !== "admin") {
    throw new Error("Unauthorized")
  }
  return session
}

/** Same idea for organiser-or-admin-gated actions (event management, etc). */
export async function requireOrganizerOrAdmin() {
  const session = await auth()
  if (!session?.user || (session.user.role !== "organizer" && session.user.role !== "admin")) {
    throw new Error("Unauthorized")
  }
  return session
}
