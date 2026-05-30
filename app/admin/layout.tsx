import { auth } from "@/auth"
import { redirect } from "next/navigation"
import Sidebar from "./_components/Sidebar"
import NotificationBell from "@/components/notifications/NotificationBell"

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session) redirect("/auth/signin?callbackUrl=/admin")
  if (session.user.role !== "admin") redirect("/dashboard")

  const name = session.user.name ?? "Admin"
  const email = session.user.email ?? ""

  return (
    <div className="lg:flex lg:items-start">
      <Sidebar name={name} email={email} />
      <main className="flex-1 min-w-0">
        {/* Top bar with notification bell (desktop) */}
        <div className="hidden lg:flex items-center justify-end px-5 md:px-8 py-3 border-b border-line">
          <NotificationBell />
        </div>
        <div className="max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  )
}
