import Link from "next/link"
import { redirect } from "next/navigation"
import { ArrowUpRight, Bus, CalendarClock, ClipboardList, QrCode, Route, Users, Wallet } from "lucide-react"

import { auth } from "@/auth"
import { isAdminRole, isTransportOperatorRole } from "@/lib/role-routes"

const stats = [
  { label: "Revenue today", value: "$0", body: "Confirmed transport bookings", icon: Wallet },
  { label: "Passengers today", value: "0", body: "Paid seats across departures", icon: Users },
  { label: "Occupancy", value: "0%", body: "Booked seats vs available seats", icon: Bus },
  { label: "Active departures", value: "0", body: "Trips open for boarding", icon: CalendarClock },
]

const modules = [
  { title: "Routes", body: "Create city-to-city and event shuttle routes.", icon: Route },
  { title: "Departures", body: "Schedule trips, prices, capacity, and cutoff times.", icon: CalendarClock },
  { title: "Bookings", body: "Track paid seats, pending orders, and customer contacts.", icon: ClipboardList },
  { title: "QR validation", body: "Use the shared TicketPulse scanner for boarding.", icon: QrCode },
  { title: "Manifests", body: "Export passenger lists for drivers and conductors.", icon: Users },
  { title: "Payouts", body: "View revenue less platform fees and request settlement.", icon: Wallet },
]

export default async function TransportDashboardPage() {
  const session = await auth()
  if (!session) redirect("/auth/signin?callbackUrl=/transport/dashboard")
  if (!isTransportOperatorRole(session.user.role) && !isAdminRole(session.user.role)) redirect("/dashboard")

  return (
    <main className="min-h-screen bg-paper">
      <section className="border-b border-line bg-paper-2">
        <div className="mx-auto max-w-7xl px-5 py-8 md:px-8 md:py-10">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-blue">Transport operator</p>
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-[28px] font-bold tracking-tight text-ink md:text-[36px]">Transport dashboard</h1>
              <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-ink-2">
                Manage passenger ticketing, QR boarding, manifests, revenue, and payouts inside the same TicketPulse platform.
              </p>
            </div>
            <Link href="/admin/transport" className="inline-flex items-center gap-2 rounded-xl border border-line bg-paper px-4 py-2.5 text-[13px] font-semibold text-ink hover:border-line-2">
              Admin control <ArrowUpRight size={14} />
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl space-y-8 px-5 py-8 md:px-8">
        <div className="grid gap-4 md:grid-cols-4">
          {stats.map(({ label, value, body, icon: Icon }) => (
            <article key={label} className="rounded-2xl border border-line bg-paper p-5">
              <div className="mb-4 flex items-center gap-2 text-[13px] text-ink-3">
                <Icon size={15} />
                {label}
              </div>
              <p className="text-[30px] font-bold tracking-tight text-ink">{value}</p>
              <p className="mt-1 text-[12px] text-ink-3">{body}</p>
            </article>
          ))}
        </div>

        <div className="rounded-2xl border border-line bg-paper p-5 md:p-6">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-[20px] font-semibold tracking-tight text-ink">Operations</h2>
              <p className="mt-1 text-[13px] text-ink-3">The next build-out turns these modules into route, departure, seat, and manifest tools.</p>
            </div>
            <span className="rounded-full bg-green-50 px-3 py-1 text-[12px] font-semibold text-green-700">Unified platform</span>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {modules.map(({ title, body, icon: Icon }) => (
              <div key={title} className="rounded-xl border border-line bg-paper-2 p-4">
                <Icon size={18} className="mb-3 text-navy" />
                <h3 className="text-[15px] font-semibold text-ink">{title}</h3>
                <p className="mt-1 text-[12px] leading-relaxed text-ink-3">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  )
}
