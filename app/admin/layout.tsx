import type { Metadata } from "next"
import { auth } from "@/auth"
import { redirect } from "next/navigation"
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

  return (
    <div className="lg:flex lg:items-start">
      <Sidebar name={name} email={email} />
      <main className="flex-1 min-w-0 bg-paper-2 min-h-[calc(100vh-6rem)]">
        {children}
      </main>
    </div>
  )
}
