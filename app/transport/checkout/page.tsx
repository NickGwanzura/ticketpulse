import Link from "next/link"
import { ArrowRight, CreditCard, MapPin, QrCode, Route, UserRound } from "lucide-react"

import { TRANSPORT_DEMO_ROUTE } from "@/lib/transport-demo"

export default function TransportCheckoutPreviewPage() {
  return (
    <main className="min-h-screen bg-paper">
      <section className="mx-auto grid max-w-6xl gap-6 px-5 py-10 md:grid-cols-[1fr_0.75fr] md:px-8">
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-blue">Transport checkout</p>
          <h1 className="text-[30px] font-bold tracking-tight text-ink md:text-[42px]">Passenger seat purchase preview.</h1>
          <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-ink-2">
            This is the next checkout contract: route, departure, seat count or seat number, passenger details, then payment through the existing TicketPulse checkout engine.
          </p>

          <div className="mt-6 grid gap-3">
            {[
              { label: "Route", value: `${TRANSPORT_DEMO_ROUTE.origin} to ${TRANSPORT_DEMO_ROUTE.destination}`, icon: Route },
              { label: "Pickup and dropoff", value: `${TRANSPORT_DEMO_ROUTE.pickupPoint} -> ${TRANSPORT_DEMO_ROUTE.dropoffPoint}`, icon: MapPin },
              { label: "Passenger details", value: "Name, email, phone, optional ID/reference", icon: UserRound },
              { label: "Payment", value: "EcoCash or Visa via existing checkout ledger", icon: CreditCard },
              { label: "Delivery", value: "QR boarding pass by email, account, and WhatsApp-ready delivery", icon: QrCode },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label} className="flex items-start gap-3 rounded-2xl border border-line bg-paper p-4">
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-paper-2 text-navy">
                  <Icon size={18} />
                </span>
                <div>
                  <p className="text-[14px] font-semibold text-ink">{label}</p>
                  <p className="mt-1 text-[13px] text-ink-3">{value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <aside className="rounded-3xl border border-line bg-paper-2 p-5">
          <div className="rounded-2xl border border-line bg-paper p-5">
            <h2 className="text-[20px] font-semibold text-ink">Order summary</h2>
            <div className="mt-5 space-y-3 text-[14px]">
              <div className="flex justify-between gap-4"><span className="text-ink-3">Seat</span><span className="font-semibold text-ink">12A</span></div>
              <div className="flex justify-between gap-4"><span className="text-ink-3">Passenger</span><span className="font-semibold text-ink">Demo Passenger</span></div>
              <div className="flex justify-between gap-4"><span className="text-ink-3">Fare</span><span className="font-semibold text-ink">${TRANSPORT_DEMO_ROUTE.price}</span></div>
              <div className="border-t border-line pt-3 flex justify-between gap-4"><span className="font-semibold text-ink">Total</span><span className="font-bold text-ink">${TRANSPORT_DEMO_ROUTE.price}</span></div>
            </div>
            <Link href="/transport/boarding-pass" className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-3 text-[14px] font-semibold text-white">
              Preview paid ticket <ArrowRight size={14} />
            </Link>
          </div>
        </aside>
      </section>
    </main>
  )
}
