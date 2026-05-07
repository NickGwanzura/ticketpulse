import { auth } from "@/auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Ticket, Calendar, ArrowUpRight } from "lucide-react"

export default async function DashboardPage() {
  const session = await auth()
  if (!session) redirect("/auth/signin")

  return (
    <div>
      <div className="border-b border-line bg-paper-2">
        <div className="max-w-6xl mx-auto px-5 md:px-8 py-10 md:py-14">
          <p className="text-[11px] font-semibold tracking-[0.18em] text-blue uppercase mb-2">Dashboard</p>
          <h1 className="text-[32px] md:text-[40px] font-bold tracking-tight leading-tight text-ink">
            Welcome back, {session.user.name?.split(" ")[0] ?? "there"}
          </h1>
          <p className="mt-1.5 text-[14.5px] text-ink-2">{session.user.email}</p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-5 md:px-8 py-10 md:py-12">
        <div className="rounded-2xl border border-dashed border-line bg-paper-2 p-6 mb-10 text-center">
          <p className="text-[15px] font-medium text-ink mb-1">Your activity will appear here</p>
          <p className="text-sm text-ink-2">Tickets, merch, shuttle bookings, and photo packs all in one place.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
          <div className="rounded-2xl border border-line bg-paper p-6">
            <h2 className="text-[18px] font-semibold tracking-tight text-ink mb-4">Quick actions</h2>
            <div className="space-y-1">
              <Link href="/events" className="flex items-center gap-3 p-3 rounded-lg hover:bg-paper-2 transition-colors text-sm text-ink-2 hover:text-ink group">
                <Calendar size={16} className="text-blue" />
                <span className="flex-1">Browse events</span>
                <ArrowUpRight size={14} className="text-ink-3 group-hover:text-ink transition-colors" />
              </Link>
            </div>
          </div>

          <div className="rounded-2xl border border-line bg-paper p-6">
            <h2 className="text-[18px] font-semibold tracking-tight text-ink mb-4">Your tickets</h2>
            <div className="text-center py-10">
              <div className="mx-auto mb-4 inline-flex w-12 h-12 items-center justify-center rounded-full bg-paper-2 ring-1 ring-line">
                <Ticket size={20} className="text-ink-3" />
              </div>
              <p className="text-sm font-medium text-ink mb-1">No tickets yet</p>
              <p className="text-xs text-ink-3 mb-4">Once you book, your tickets will appear here.</p>
              <Link
                href="/events"
                className="inline-flex items-center gap-1 text-sm font-semibold text-navy hover:gap-1.5 transition-all"
              >
                Browse events <ArrowUpRight size={13} />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
