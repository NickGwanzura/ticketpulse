import Link from "next/link"
import { redirect } from "next/navigation"
import { ArrowUpRight, Bus, CalendarClock, ClipboardList, QrCode, Route, ScanLine, ShieldCheck, Users, Wallet } from "lucide-react"

import { auth } from "@/auth"
import { isAdminRole, isTransportOperatorRole } from "@/lib/role-routes"
import { TRANSPORT_DEMO_OPERATOR, TRANSPORT_DEMO_PAYOUT, TRANSPORT_DEMO_ROUTE } from "@/lib/transport-demo"

const stats = [
  { label: "Revenue today", value: `$${TRANSPORT_DEMO_PAYOUT.gross}`, body: "Confirmed transport bookings", icon: Wallet },
  { label: "Passengers today", value: String(TRANSPORT_DEMO_ROUTE.bookedSeats), body: "Paid seats across departures", icon: Users },
  { label: "Occupancy", value: `${Math.round((TRANSPORT_DEMO_ROUTE.bookedSeats / TRANSPORT_DEMO_ROUTE.capacity) * 100)}%`, body: "Booked seats vs available seats", icon: Bus },
  { label: "Active departures", value: "3", body: "Trips open for boarding", icon: CalendarClock },
]

const modules = [
  { title: "Operator onboarding", body: "Company details, contacts, routes served, payout details, and verification.", icon: ShieldCheck, href: "/transport/apply" },
  { title: "Routes and departures", body: "Create routes, schedule trips, set prices, capacity, and cutoff times.", icon: Route, href: "/transport/routes" },
  { title: "Checkout preview", body: "Passenger route, departure, seat, and payment handoff flow.", icon: ClipboardList, href: "/transport/checkout" },
  { title: "Boarding pass", body: "Real transport QR ticket shape after confirmed payment.", icon: QrCode, href: "/transport/boarding-pass" },
  { title: "Crew scanner", body: "Mobile-first scan, valid, duplicate, invalid, no-show, and manifest states.", icon: ScanLine, href: "/crew?preview=1" },
  { title: "Manifest export", body: "Passenger list, seat list, payment status, check-in status, CSV/PDF actions.", icon: Users, href: "/transport/manifest" },
  { title: "Transport payouts", body: "Gross sales, TicketPulse fee, net earned, paid out, and available balance.", icon: Wallet, href: "/transport/payouts" },
]

export default async function TransportDashboardPage({
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
    if (!session) redirect("/auth/signin?callbackUrl=/transport/dashboard")
    if (!isTransportOperatorRole(session.user.role) && !isAdminRole(session.user.role)) redirect("/dashboard")
  }

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
            <div className="flex flex-wrap gap-2">
              {previewMode && (
                <span className="inline-flex items-center rounded-xl bg-green-50 px-4 py-2.5 text-[13px] font-semibold text-green-700">
                  Preview mode
                </span>
              )}
              <Link href="/admin/transport" className="inline-flex items-center gap-2 rounded-xl border border-line bg-paper px-4 py-2.5 text-[13px] font-semibold text-ink hover:border-line-2">
                Admin control <ArrowUpRight size={14} />
              </Link>
            </div>
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
              <h2 className="text-[20px] font-semibold tracking-tight text-ink">{TRANSPORT_DEMO_OPERATOR.companyName}</h2>
              <p className="mt-1 text-[13px] text-ink-3">
                {TRANSPORT_DEMO_ROUTE.origin} to {TRANSPORT_DEMO_ROUTE.destination} demo operation · {TRANSPORT_DEMO_OPERATOR.verificationStatus}
              </p>
            </div>
            <span className="rounded-full bg-green-50 px-3 py-1 text-[12px] font-semibold text-green-700">Unified platform</span>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {modules.map(({ title, body, icon: Icon, href }) => (
              <Link key={title} href={href} className="group rounded-xl border border-line bg-paper-2 p-4 transition hover:border-line-2 hover:bg-paper">
                <Icon size={18} className="mb-3 text-navy" />
                <h3 className="text-[15px] font-semibold text-ink group-hover:text-navy">{title}</h3>
                <p className="mt-1 text-[12px] leading-relaxed text-ink-3">{body}</p>
                <p className="mt-3 inline-flex items-center gap-1 text-[12px] font-semibold text-navy">Open <ArrowUpRight size={12} /></p>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </main>
  )
}
