"use client"
import { Bus, MapPin, Clock, Users, CheckCircle } from "lucide-react"
import { formatCurrency, availabilityLabel, vehicleLabel } from "@/lib/utils"
import type { ShuttleRoute } from "@/types"
import { useState } from "react"

interface TransportSectionProps {
  routes: ShuttleRoute[]
}

export default function TransportSection({ routes }: TransportSectionProps) {
  const [booking, setBooking] = useState<string | null>(null)
  const [seats, setSeats] = useState<Record<string, number>>({})

  if (!routes.length) return null

  return (
    <section>
      <div className="flex items-center gap-3 mb-6">
        <span className="inline-flex w-9 h-9 items-center justify-center rounded-xl bg-green-50 ring-1 ring-green-500/15">
          <Bus size={16} className="text-green-600" />
        </span>
        <div>
          <p className="text-[11px] font-semibold tracking-[0.18em] text-blue uppercase">Event Transport</p>
          <h2 className="text-[18px] font-semibold tracking-tight text-ink">Shuttle bookings</h2>
        </div>
      </div>

      <div className="space-y-3">
        {routes.map((route) => {
          const avail = availabilityLabel(route.bookedSeats, route.totalSeats)
          const seatCount = seats[route.id] ?? 1
          const fullyBooked = route.bookedSeats >= route.totalSeats
          const availColor = fullyBooked ? "text-rose-700" : avail.label.includes("left") ? "text-amber-700" : "text-green-700"

          return (
            <div key={route.id} className="rounded-2xl border border-line bg-paper p-5 hover:border-line-2 transition-colors">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className="text-[10.5px] font-medium bg-paper-2 border border-line text-ink-2 px-2 py-0.5 rounded-full">
                      {vehicleLabel(route.vehicleType)}
                    </span>
                    {route.operator.verified && (
                      <span className="flex items-center gap-1 text-[10.5px] font-medium text-green-700">
                        <CheckCircle size={11} /> Verified
                      </span>
                    )}
                    <span className="text-[11px] text-ink-3">{route.operator.companyName}</span>
                  </div>

                  <div className="flex items-center gap-1.5 text-[14px] mb-1">
                    <MapPin size={13} className="text-ink-3" />
                    <span className="text-ink font-medium truncate">{route.departurePoint}</span>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2">
                    <div className="flex items-center gap-1.5 text-xs text-ink-2">
                      <Clock size={11} className="text-ink-3" />
                      {new Date(route.departureTime).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                      {route.returnTime && ` · Returns ${new Date(route.returnTime).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs">
                      <Users size={11} className="text-ink-3" />
                      <span className={availColor + " font-medium"}>{avail.label}</span>
                      <span className="text-ink-3">({route.totalSeats - route.bookedSeats} of {route.totalSeats} seats)</span>
                    </div>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className="text-[18px] font-bold tracking-tight text-ink">
                    {formatCurrency(route.pricePerSeat, route.currency)}
                  </div>
                  <div className="text-[11px] text-ink-3">per seat</div>
                </div>
              </div>

              {booking === route.id ? (
                <div className="mt-4 pt-4 border-t border-line flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSeats(p => ({ ...p, [route.id]: Math.max(1, (p[route.id] ?? 1) - 1) }))}
                      className="w-8 h-8 rounded-md border border-line bg-paper text-ink-2 hover:text-ink hover:border-line-2 flex items-center justify-center transition-colors"
                      aria-label="Decrease seats"
                    >
                      −
                    </button>
                    <span className="text-sm font-semibold w-7 text-center text-ink">{seatCount}</span>
                    <button
                      onClick={() => setSeats(p => ({ ...p, [route.id]: Math.min(route.totalSeats - route.bookedSeats, (p[route.id] ?? 1) + 1) }))}
                      className="w-8 h-8 rounded-md border border-line bg-paper text-ink-2 hover:text-ink hover:border-line-2 flex items-center justify-center transition-colors"
                      aria-label="Increase seats"
                    >
                      +
                    </button>
                    <span className="text-xs text-ink-3">seats</span>
                  </div>
                  <div className="flex-1 text-right">
                    <span className="text-sm font-bold tracking-tight text-ink">
                      Total: {formatCurrency(route.pricePerSeat * seatCount, route.currency)}
                    </span>
                  </div>
                  <button className="bg-green-600 text-white text-xs font-semibold px-4 py-2 rounded-lg hover:bg-green-700 transition-colors">
                    Confirm booking
                  </button>
                  <button onClick={() => setBooking(null)} className="text-xs text-ink-3 hover:text-ink-2">
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="mt-4 flex justify-end">
                  <button
                    onClick={() => setBooking(route.id)}
                    disabled={fullyBooked}
                    className="border border-line bg-paper text-ink-2 text-xs font-medium px-4 py-2 rounded-lg hover:bg-navy hover:text-white hover:border-navy transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-paper disabled:hover:text-ink-2 disabled:hover:border-line"
                  >
                    {fullyBooked ? "Sold out" : "Book seats"}
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
