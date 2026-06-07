import Link from "next/link"
import { ArrowRight, Bus, CalendarClock, Clock3, MapPin, Route, Users, Wallet } from "lucide-react"

import { TRANSPORT_DEMO_ROUTE, TRANSPORT_UPCOMING_DEPARTURES } from "@/lib/transport-demo"

const config = [
  { label: "Route", value: `${TRANSPORT_DEMO_ROUTE.origin} -> ${TRANSPORT_DEMO_ROUTE.destination}`, icon: Route },
  { label: "Pickup", value: TRANSPORT_DEMO_ROUTE.pickupPoint, icon: MapPin },
  { label: "Dropoff", value: TRANSPORT_DEMO_ROUTE.dropoffPoint, icon: MapPin },
  { label: "Departure", value: TRANSPORT_DEMO_ROUTE.departureTime, icon: CalendarClock },
  { label: "Cutoff", value: TRANSPORT_DEMO_ROUTE.cutoffTime, icon: Clock3 },
  { label: "Vehicle", value: `${TRANSPORT_DEMO_ROUTE.vehicle} · ${TRANSPORT_DEMO_ROUTE.capacity} seats`, icon: Bus },
  { label: "Price", value: `$${TRANSPORT_DEMO_ROUTE.price} per seat`, icon: Wallet },
  { label: "Booked", value: `${TRANSPORT_DEMO_ROUTE.bookedSeats}/${TRANSPORT_DEMO_ROUTE.capacity}`, icon: Users },
]

export default function TransportRoutesPage() {
  return (
    <main className="min-h-screen bg-paper">
      <section className="border-b border-line bg-paper-2">
        <div className="mx-auto max-w-7xl px-5 py-10 md:px-8">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-blue">Routes and departures</p>
          <h1 className="text-[30px] font-bold tracking-tight text-ink md:text-[42px]">Create routes, prices, capacity, and cutoffs.</h1>
        </div>
      </section>

      <section className="mx-auto max-w-7xl space-y-6 px-5 py-8 md:px-8">
        <div className="grid gap-3 md:grid-cols-4">
          {config.map(({ label, value, icon: Icon }) => (
            <div key={label} className="rounded-2xl border border-line bg-paper p-4">
              <Icon size={17} className="mb-3 text-navy" />
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-3">{label}</p>
              <p className="mt-1 text-[14px] font-semibold text-ink">{value}</p>
            </div>
          ))}
        </div>

        <div className="rounded-2xl border border-line bg-paper p-5 md:p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-[20px] font-semibold text-ink">Upcoming departures</h2>
            <Link href="/transport/checkout" className="inline-flex items-center gap-1 text-[13px] font-semibold text-navy">
              Preview checkout <ArrowRight size={13} />
            </Link>
          </div>
          <div className="divide-y divide-line">
            {TRANSPORT_UPCOMING_DEPARTURES.map((departure) => (
              <div key={`${departure.origin}-${departure.destination}-${departure.departureTime}`} className="grid gap-3 py-4 md:grid-cols-[1.2fr_1fr_0.7fr_0.6fr] md:items-center">
                <div>
                  <p className="text-[15px] font-semibold text-ink">{departure.origin} to {departure.destination}</p>
                  <p className="text-[12px] text-ink-3">{departure.pickupPoint} to {departure.dropoffPoint}</p>
                </div>
                <p className="text-[13px] text-ink-2">{departure.departureTime} · cutoff {departure.cutoffTime}</p>
                <p className="text-[13px] font-semibold text-ink">{departure.bookedSeats}/{departure.capacity} booked</p>
                <p className="text-[13px] font-bold text-ink">${departure.price}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  )
}
