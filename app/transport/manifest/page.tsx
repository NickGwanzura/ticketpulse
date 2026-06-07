import { Download, FileText } from "lucide-react"

import { TRANSPORT_DEMO_PASSENGERS, TRANSPORT_DEMO_ROUTE } from "@/lib/transport-demo"

export default function TransportManifestPage() {
  return (
    <main className="min-h-screen bg-paper px-5 py-10 md:px-8">
      <div className="mx-auto max-w-6xl">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-blue">Manifest export</p>
        <h1 className="text-[30px] font-bold tracking-tight text-ink md:text-[42px]">Passenger, seat, payment, and check-in status.</h1>
        <div className="mt-6 rounded-2xl border border-line bg-paper">
          <div className="flex flex-col gap-3 border-b border-line p-5 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-[18px] font-semibold text-ink">{TRANSPORT_DEMO_ROUTE.origin} to {TRANSPORT_DEMO_ROUTE.destination}</h2>
              <p className="text-[13px] text-ink-3">{TRANSPORT_DEMO_ROUTE.departureTime} · {TRANSPORT_DEMO_ROUTE.bookedSeats} booked</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button className="inline-flex items-center gap-2 rounded-xl border border-line bg-paper px-4 py-2.5 text-[13px] font-semibold text-ink">
                <Download size={14} /> CSV
              </button>
              <button className="inline-flex items-center gap-2 rounded-xl border border-line bg-paper px-4 py-2.5 text-[13px] font-semibold text-ink">
                <FileText size={14} /> PDF
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-[13px]">
              <thead className="border-b border-line bg-paper-2 text-ink-3">
                <tr>
                  {["Passenger", "Phone", "Seat", "Payment", "Check-in"].map((h) => (
                    <th key={h} className="px-5 py-3 font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {TRANSPORT_DEMO_PASSENGERS.map((p) => (
                  <tr key={`${p.name}-${p.seat}`}>
                    <td className="px-5 py-4 font-semibold text-ink">{p.name}</td>
                    <td className="px-5 py-4 text-ink-2">{p.phone}</td>
                    <td className="px-5 py-4 font-semibold text-ink">{p.seat}</td>
                    <td className="px-5 py-4 text-ink-2">{p.payment}</td>
                    <td className="px-5 py-4 text-ink-2">{p.checkIn}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  )
}
