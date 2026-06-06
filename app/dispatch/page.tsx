import { redirect } from "next/navigation"
import { Bus, CalendarClock, ClipboardList, Gauge, Users } from "lucide-react"

import { auth } from "@/auth"
import { isAdminRole, isDispatchRole } from "@/lib/role-routes"

const modules = [
  { title: "Departures", body: "Monitor trips that are loading, departed, or delayed.", icon: CalendarClock },
  { title: "Fleet assignment", body: "Assign vehicles to departures before boarding opens.", icon: Bus },
  { title: "Crew assignment", body: "Attach drivers and conductors to each trip.", icon: Users },
  { title: "Manifest", body: "View passenger counts and no-show status without revenue access.", icon: ClipboardList },
]

export default async function DispatchDashboardPage() {
  const session = await auth()
  if (!session) redirect("/auth/signin?callbackUrl=/dispatch")
  if (!isDispatchRole(session.user.role) && !isAdminRole(session.user.role)) redirect("/dashboard")

  return (
    <main className="min-h-screen bg-paper">
      <section className="border-b border-line bg-paper-2">
        <div className="mx-auto max-w-6xl px-5 py-8 md:px-8 md:py-10">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-blue">Dispatch</p>
          <h1 className="text-[28px] font-bold tracking-tight text-ink md:text-[36px]">Dispatch dashboard</h1>
          <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-ink-2">
            Coordinate routes, fleet, staff, boarding, and passenger manifests without exposing payout or revenue controls.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl space-y-6 px-5 py-8 md:px-8">
        <div className="grid gap-4 md:grid-cols-3">
          {[
            { label: "Trips today", value: "0" },
            { label: "Passengers checked in", value: "0" },
            { label: "Open boarding windows", value: "0" },
          ].map((item) => (
            <article key={item.label} className="rounded-2xl border border-line bg-paper p-5">
              <div className="mb-3 flex items-center gap-2 text-[13px] text-ink-3">
                <Gauge size={15} />
                {item.label}
              </div>
              <p className="text-[30px] font-bold tracking-tight text-ink">{item.value}</p>
            </article>
          ))}
        </div>

        <div className="grid gap-3 md:grid-cols-4">
          {modules.map(({ title, body, icon: Icon }) => (
            <div key={title} className="rounded-xl border border-line bg-paper-2 p-4">
              <Icon size={18} className="mb-3 text-navy" />
              <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
              <p className="mt-1 text-[12px] leading-relaxed text-ink-3">{body}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}
