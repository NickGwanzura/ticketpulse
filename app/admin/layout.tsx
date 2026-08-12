import type { Metadata } from "next"
import { eq, sql } from "drizzle-orm"
import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { db } from "@/db"
import { events, vendors } from "@/db/schema"
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

  const [[pendingEventsRow], [pendingVendorsRow]] = await Promise.all([
    db.select({ count: sql<number>`COUNT(*)::int` }).from(events).where(eq(events.status, "pending_review")),
    db.select({ count: sql<number>`COUNT(*)::int` }).from(vendors).where(eq(vendors.verified, false)),
  ])

  return (
    <div className="lg:flex lg:items-start">
      <Sidebar
        name={name}
        email={email}
        pendingEventCount={pendingEventsRow?.count ?? 0}
        pendingVendorCount={pendingVendorsRow?.count ?? 0}
      />
      <main className="flex-1 min-w-0 bg-paper-2 min-h-[calc(100vh-6rem)]">
        {children}
      </main>
    </div>
  )
}
