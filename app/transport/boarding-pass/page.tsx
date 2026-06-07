import Link from "next/link"
import { ArrowRight, CalendarClock, MapPin, QrCode, ShieldCheck, Users } from "lucide-react"

import { TRANSPORT_DEMO_ROUTE } from "@/lib/transport-demo"

export default async function TransportBoardingPassPage({
  searchParams,
}: {
  searchParams: Promise<{ seat?: string }>
}) {
  const { seat: requestedSeat } = await searchParams
  const seat = requestedSeat?.trim() || "12A"

  return (
    <main className="min-h-screen bg-paper px-5 py-10 md:px-8">
      <div className="mx-auto max-w-4xl">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-blue">Boarding pass</p>
        <h1 className="text-[30px] font-bold tracking-tight text-ink md:text-[42px]">Transport QR ticket after payment.</h1>
        <div className="mt-6 overflow-hidden rounded-3xl border border-line bg-paper shadow-sm">
          <div className="flex items-start justify-between gap-4 bg-ink p-6 text-white">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/60">TicketPulse transport</p>
              <h2 className="mt-2 text-[28px] font-bold">{TRANSPORT_DEMO_ROUTE.origin} to {TRANSPORT_DEMO_ROUTE.destination}</h2>
            </div>
            <span className="rounded-full bg-white px-3 py-1 text-[12px] font-bold text-ink">Paid</span>
          </div>
          <div className="grid gap-6 p-6 md:grid-cols-[1fr_220px]">
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                { label: "Passenger", value: "Demo Passenger", icon: Users },
                { label: "Seat", value: seat, icon: Users },
                { label: "Departure", value: TRANSPORT_DEMO_ROUTE.departureTime, icon: CalendarClock },
                { label: "Pickup", value: TRANSPORT_DEMO_ROUTE.pickupPoint, icon: MapPin },
                { label: "Operator", value: TRANSPORT_DEMO_ROUTE.operator, icon: ShieldCheck },
                { label: "Manifest", value: "Ready for boarding", icon: ShieldCheck },
              ].map(({ label, value, icon: Icon }) => (
                <div key={label} className="rounded-2xl border border-line bg-paper-2 p-4">
                  <Icon size={16} className="mb-2 text-navy" />
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-3">{label}</p>
                  <p className="mt-1 text-[14px] font-semibold text-ink">{value}</p>
                </div>
              ))}
            </div>
            <div className="rounded-2xl border border-line bg-white p-5 text-center">
              <div className="mx-auto grid h-40 w-40 place-items-center rounded-2xl bg-paper-2 text-ink">
                <QrCode size={94} />
              </div>
              <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-3">QR payload</p>
              <p className="mt-1 text-[12px] text-ink-3">ticketpulse:transport:demo:{seat}</p>
            </div>
          </div>
        </div>
        <Link href="/crew?preview=1" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-3 text-[14px] font-semibold text-white">
          Preview crew scan <ArrowRight size={14} />
        </Link>
      </div>
    </main>
  )
}
