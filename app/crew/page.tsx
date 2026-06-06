import { redirect } from "next/navigation"
import { Bus, ClipboardList, MapPin, ScanLine, Users } from "lucide-react"

import { auth } from "@/auth"
import { isAdminRole, isCrewRole } from "@/lib/role-routes"

export default async function CrewDashboardPage() {
  const session = await auth()
  if (!session) redirect("/auth/signin?callbackUrl=/crew")
  if (!isCrewRole(session.user.role) && !isAdminRole(session.user.role)) redirect("/dashboard")

  return (
    <main className="min-h-screen bg-paper">
      <section className="border-b border-line bg-paper-2">
        <div className="mx-auto max-w-3xl px-5 py-8">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-blue">Crew</p>
          <h1 className="text-[28px] font-bold tracking-tight text-ink">Boarding tools</h1>
          <p className="mt-2 text-[14px] leading-relaxed text-ink-2">
            Driver and conductor access is mobile-first: assigned trips, passenger manifest, QR scan, route notes, and no-show marking.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-3xl space-y-4 px-5 py-6">
        <div className="rounded-2xl border border-line bg-paper p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-[18px] font-semibold text-ink">Assigned trip</h2>
              <p className="text-[12px] text-ink-3">No active assignment yet.</p>
            </div>
            <Bus size={22} className="text-navy" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Passengers", value: "0", icon: Users },
              { label: "Checked in", value: "0", icon: ScanLine },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label} className="rounded-xl bg-paper-2 p-4">
                <Icon size={16} className="mb-2 text-ink-3" />
                <p className="text-[24px] font-bold text-ink">{value}</p>
                <p className="text-[12px] text-ink-3">{label}</p>
              </div>
            ))}
          </div>
        </div>

        {[
          { title: "Scan boarding pass", body: "Validate TicketPulse transport QR codes and prevent duplicate boarding.", icon: ScanLine },
          { title: "Passenger manifest", body: "See paid passengers, phone numbers, seat labels, and no-shows.", icon: ClipboardList },
          { title: "Route notes", body: "View departure point, stops, destination, and dispatcher notes.", icon: MapPin },
        ].map(({ title, body, icon: Icon }) => (
          <div key={title} className="flex items-start gap-3 rounded-2xl border border-line bg-paper p-4">
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-paper-2 text-navy">
              <Icon size={18} />
            </span>
            <div>
              <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
              <p className="mt-1 text-[12px] leading-relaxed text-ink-3">{body}</p>
            </div>
          </div>
        ))}
      </section>
    </main>
  )
}
