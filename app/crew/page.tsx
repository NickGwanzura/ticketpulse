import { redirect } from "next/navigation"
import { AlertTriangle, Bus, CheckCircle2, ClipboardList, MapPin, ScanLine, UserX, Users, XCircle } from "lucide-react"

import { auth } from "@/auth"
import { isAdminRole, isCrewRole } from "@/lib/role-routes"
import { TRANSPORT_DEMO_PASSENGERS, TRANSPORT_DEMO_ROUTE } from "@/lib/transport-demo"

export default async function CrewDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ preview?: string }>
}) {
  const sp = await searchParams
  const localPreviewMode =
    process.env.NODE_ENV !== "production" &&
    !process.env.AUTH_SECRET &&
    !process.env.NEXTAUTH_SECRET
  const previewMode = sp.preview === "1" || localPreviewMode

  if (!previewMode) {
    const session = await auth()
    if (!session) redirect("/auth/signin?callbackUrl=/crew")
    if (!isCrewRole(session.user.role) && !isAdminRole(session.user.role)) redirect("/dashboard")
  }

  return (
    <main className="min-h-screen bg-paper">
      <section className="border-b border-line bg-paper-2">
        <div className="mx-auto max-w-3xl px-5 py-8">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-blue">Crew</p>
          <h1 className="text-[28px] font-bold tracking-tight text-ink">Boarding tools</h1>
          <p className="mt-2 text-[14px] leading-relaxed text-ink-2">
            Driver and conductor access is mobile-first: assigned trips, passenger manifest, QR scan, route notes, and no-show marking.
          </p>
          {previewMode && (
            <span className="mt-4 inline-flex rounded-xl bg-green-50 px-3 py-1.5 text-[12px] font-semibold text-green-700">Preview mode</span>
          )}
        </div>
      </section>

      <section className="mx-auto max-w-3xl space-y-4 px-5 py-6">
        <div className="rounded-2xl border border-line bg-paper p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-[18px] font-semibold text-ink">Assigned trip</h2>
              <p className="text-[12px] text-ink-3">{TRANSPORT_DEMO_ROUTE.origin} to {TRANSPORT_DEMO_ROUTE.destination} · {TRANSPORT_DEMO_ROUTE.departureTime}</p>
            </div>
            <Bus size={22} className="text-navy" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Passengers", value: String(TRANSPORT_DEMO_ROUTE.bookedSeats), icon: Users },
              { label: "Checked in", value: "12", icon: ScanLine },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label} className="rounded-xl bg-paper-2 p-4">
                <Icon size={16} className="mb-2 text-ink-3" />
                <p className="text-[24px] font-bold text-ink">{value}</p>
                <p className="text-[12px] text-ink-3">{label}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-3">
          {[
            { title: "Valid scan", body: "Seat 12A admitted. Manifest status updates to checked in.", icon: CheckCircle2, tone: "text-green-700 bg-green-50 border-green-500/20" },
            { title: "Duplicate scan", body: "Seat 05A was already checked in. Crew sees warning before boarding.", icon: AlertTriangle, tone: "text-amber-700 bg-amber-50 border-amber-500/20" },
            { title: "Invalid ticket", body: "Unknown or expired QR is rejected and logged for admin review.", icon: XCircle, tone: "text-rose-700 bg-rose-50 border-rose-500/20" },
            { title: "Mark no-show", body: "Passenger remains on manifest but is excluded from boarded count.", icon: UserX, tone: "text-ink bg-paper-2 border-line" },
          ].map(({ title, body, icon: Icon, tone }) => (
            <div key={title} className={`flex items-start gap-3 rounded-2xl border p-4 ${tone}`}>
              <Icon size={18} className="mt-0.5 shrink-0" />
              <div>
                <h2 className="text-[15px] font-semibold">{title}</h2>
                <p className="mt-1 text-[12px] leading-relaxed">{body}</p>
              </div>
            </div>
          ))}
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

        <div className="rounded-2xl border border-line bg-paper p-4">
          <h2 className="text-[16px] font-semibold text-ink">Manifest preview</h2>
          <div className="mt-3 divide-y divide-line">
            {TRANSPORT_DEMO_PASSENGERS.slice(0, 3).map((passenger) => (
              <div key={passenger.seat} className="flex items-center justify-between gap-3 py-3">
                <div>
                  <p className="text-[14px] font-semibold text-ink">{passenger.name}</p>
                  <p className="text-[12px] text-ink-3">{passenger.phone}</p>
                </div>
                <div className="text-right">
                  <p className="text-[13px] font-bold text-ink">{passenger.seat}</p>
                  <p className="text-[11px] text-ink-3">{passenger.checkIn}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  )
}
