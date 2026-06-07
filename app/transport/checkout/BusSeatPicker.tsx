"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { ArrowRight, Armchair, DoorOpen, ShipWheel, UserRound } from "lucide-react"

import { TRANSPORT_DEMO_ROUTE } from "@/lib/transport-demo"

const seatRows = Array.from({ length: 13 }, (_, rowIndex) => {
  const row = String(rowIndex + 1).padStart(2, "0")
  return ["A", "B", "C", "D"].map((letter) => `${row}${letter}`)
})

const occupiedSeats = new Set([
  "01A",
  "01B",
  "02C",
  "03A",
  "04A",
  "04B",
  "05D",
  "06C",
  "07A",
  "08B",
  "08C",
  "09D",
  "10A",
  "11C",
  "13B",
])

const heldSeats = new Set(["02D", "12D"])
const prioritySeats = new Set(["01C", "01D"])

function getSeatStatus(seat: string, selectedSeat: string) {
  if (seat === selectedSeat) return "selected"
  if (occupiedSeats.has(seat)) return "occupied"
  if (heldSeats.has(seat)) return "held"
  if (prioritySeats.has(seat)) return "priority"
  return "available"
}

const statusClassNames = {
  available: "border-line bg-white text-ink hover:border-brand-600 hover:bg-blue/5",
  selected: "border-brand-600 bg-brand-600 text-white shadow-lg shadow-brand-600/20",
  occupied: "cursor-not-allowed border-slate-200 bg-slate-200 text-slate-400",
  held: "cursor-not-allowed border-amber-200 bg-amber-50 text-amber-700",
  priority: "border-emerald-200 bg-emerald-50 text-emerald-800 hover:border-emerald-500",
}

const statusLabels = {
  available: "Available",
  selected: "Selected",
  occupied: "Booked",
  held: "Held",
  priority: "Priority",
}

export function BusSeatPicker() {
  const [selectedSeat, setSelectedSeat] = useState("12A")

  const availableCount = useMemo(() => {
    return seatRows.flat().filter((seat) => !occupiedSeats.has(seat) && !heldSeats.has(seat)).length
  }, [])

  const selectedStatus = getSeatStatus(selectedSeat, selectedSeat)

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <section className="overflow-hidden rounded-[28px] border border-line bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 bg-ink px-5 py-4 text-white">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/60">Choose your seat</p>
            <h2 className="mt-1 text-[22px] font-bold">{TRANSPORT_DEMO_ROUTE.vehicle}</h2>
          </div>
          <div className="rounded-full bg-white px-3 py-1 text-[12px] font-bold text-ink">
            {availableCount} seats open
          </div>
        </div>

        <div className="grid gap-6 p-4 md:grid-cols-[minmax(0,1fr)_220px] md:p-6">
          <div className="mx-auto w-full max-w-[520px] rounded-[34px] border border-slate-200 bg-slate-50 p-3 shadow-inner">
            <div className="rounded-[28px] border border-slate-200 bg-white p-4">
              <div className="mb-4 flex items-center justify-between rounded-2xl bg-slate-100 px-4 py-3">
                <div className="flex items-center gap-2 text-[13px] font-semibold text-ink">
                  <DoorOpen size={18} />
                  Front door
                </div>
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-ink text-white">
                  <ShipWheel size={20} />
                </div>
              </div>

              <div className="grid gap-2">
                {seatRows.map((rowSeats, index) => (
                  <div key={rowSeats.join("-")} className="grid grid-cols-[34px_1fr_1fr_22px_1fr_1fr] items-center gap-2">
                    <div className="text-center text-[11px] font-semibold text-ink-3">{index + 1}</div>
                    {rowSeats.slice(0, 2).map((seat) => (
                      <SeatButton key={seat} seat={seat} selectedSeat={selectedSeat} onSelect={setSelectedSeat} />
                    ))}
                    <div className="h-full rounded-full bg-slate-100" aria-hidden="true" />
                    {rowSeats.slice(2).map((seat) => (
                      <SeatButton key={seat} seat={seat} selectedSeat={selectedSeat} onSelect={setSelectedSeat} />
                    ))}
                  </div>
                ))}
              </div>

              <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-center text-[12px] font-semibold uppercase tracking-[0.14em] text-ink-3">
                Luggage bay and rear exit
              </div>
            </div>
          </div>

          <aside className="space-y-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-3">Legend</p>
              <div className="mt-3 grid gap-2">
                {(["available", "selected", "priority", "held", "occupied"] as const).map((status) => (
                  <div key={status} className="flex items-center gap-2 text-[13px] text-ink-2">
                    <span className={`h-5 w-5 rounded-md border ${statusClassNames[status]}`} />
                    {statusLabels[status]}
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-line bg-paper-2 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-3">Trip</p>
              <p className="mt-2 text-[18px] font-bold text-ink">
                {TRANSPORT_DEMO_ROUTE.origin} to {TRANSPORT_DEMO_ROUTE.destination}
              </p>
              <p className="mt-1 text-[13px] text-ink-3">{TRANSPORT_DEMO_ROUTE.departureTime}</p>
            </div>

            <div className="rounded-2xl border border-line bg-paper-2 p-4">
              <div className="flex items-center gap-2 text-[13px] font-semibold text-ink">
                <Armchair size={16} />
                Seat {selectedSeat}
              </div>
              <p className="mt-2 text-[13px] leading-relaxed text-ink-3">
                {selectedStatus === "selected"
                  ? "This seat is reserved in your checkout preview until payment is completed."
                  : "Choose an available seat from the bus map."}
              </p>
            </div>
          </aside>
        </div>
      </section>

      <aside className="rounded-[28px] border border-line bg-paper-2 p-5">
        <div className="rounded-2xl border border-line bg-paper p-5">
          <h2 className="text-[20px] font-semibold text-ink">Order summary</h2>
          <div className="mt-5 space-y-3 text-[14px]">
            <div className="flex justify-between gap-4">
              <span className="text-ink-3">Seat</span>
              <span className="font-semibold text-ink">{selectedSeat}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-ink-3">Passenger</span>
              <span className="font-semibold text-ink">Demo Passenger</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-ink-3">Fare</span>
              <span className="font-semibold text-ink">${TRANSPORT_DEMO_ROUTE.price}</span>
            </div>
            <div className="flex justify-between gap-4 border-t border-line pt-3">
              <span className="font-semibold text-ink">Total</span>
              <span className="font-bold text-ink">${TRANSPORT_DEMO_ROUTE.price}</span>
            </div>
          </div>

          <div className="mt-5 grid gap-3">
            <label className="grid gap-2 text-[13px] font-semibold text-ink">
              Passenger name
              <span className="flex items-center gap-2 rounded-xl border border-line bg-white px-3 py-3 text-[14px] font-medium text-ink-2">
                <UserRound size={16} />
                Demo Passenger
              </span>
            </label>
          </div>

          <Link
            href={`/transport/boarding-pass?seat=${encodeURIComponent(selectedSeat)}`}
            className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-3 text-[14px] font-semibold text-white shadow-sm transition hover:bg-ink"
          >
            Continue with seat {selectedSeat} <ArrowRight size={14} />
          </Link>
        </div>
      </aside>
    </div>
  )
}

function SeatButton({
  seat,
  selectedSeat,
  onSelect,
}: {
  seat: string
  selectedSeat: string
  onSelect: (seat: string) => void
}) {
  const status = getSeatStatus(seat, selectedSeat)
  const isDisabled = status === "occupied" || status === "held"

  return (
    <button
      type="button"
      disabled={isDisabled}
      aria-pressed={status === "selected"}
      aria-label={`Seat ${seat}, ${statusLabels[status]}`}
      onClick={() => onSelect(seat)}
      className={`grid aspect-square min-h-12 place-items-center rounded-xl border text-[11px] font-bold transition ${statusClassNames[status]}`}
    >
      <Armchair size={16} />
      <span>{seat.slice(2)}</span>
    </button>
  )
}
