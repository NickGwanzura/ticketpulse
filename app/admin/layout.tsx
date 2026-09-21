import type { Metadata } from "next"
import { and, eq, isNull, sql } from "drizzle-orm"
import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { db } from "@/db"
import { events, users, vendors } from "@/db/schema"
import Sidebar from "./_components/Sidebar"

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session) redirect("/auth/signin?callbackUrl=/admin")
  if (session.user.role !== "admin") redirect("/dashboard")

  const name = session.user.name ?? "Admin"
  const email = session.user.email ?? ""

  // These badges render on every admin page. If the count queries fail, show the
  // pages without badges instead of taking the whole admin section down.
  const counts = await Promise.all([
    db.select({ count: sql<number>`COUNT(*)::int` }).from(events).where(eq(events.status, "pending_review")),
    db.select({ count: sql<number>`COUNT(*)::int` }).from(vendors).where(eq(vendors.verified, false)),
    db.select({ count: sql<number>`COUNT(*)::int` })
      .from(users)
      .where(and(eq(users.role, "organizer"), isNull(users.approvedAt))),
  ]).catch((error) => {
    console.error("[admin] layout badge counts failed", error)
    return null
  })
  const [[pendingEventsRow], [pendingVendorsRow], [pendingOrganizersRow]] = counts ?? [[], [], []]

  return (
    <div className="lg:flex lg:items-start">
      <Sidebar
        name={name}
        email={email}
        pendingEventCount={pendingEventsRow?.count ?? 0}
        pendingVendorCount={pendingVendorsRow?.count ?? 0}
        pendingOrganizerCount={pendingOrganizersRow?.count ?? 0}
      />
      <main className="flex-1 min-w-0 bg-paper-2 min-h-[calc(100vh-6rem)]">
        {children}
      </main>
    </div>
  )
}
