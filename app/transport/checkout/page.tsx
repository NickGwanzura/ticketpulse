import { CreditCard, MapPin, QrCode, Route, UserRound } from "lucide-react"

import { TRANSPORT_DEMO_ROUTE } from "@/lib/transport-demo"
import { BusSeatPicker } from "./BusSeatPicker"

export default function TransportCheckoutPreviewPage() {
  return (
    <main className="min-h-screen bg-paper">
      <section className="mx-auto max-w-7xl px-5 py-10 md:px-8">
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-blue">Transport checkout</p>
          <h1 className="text-[30px] font-bold tracking-tight text-ink md:text-[42px]">Choose your seat before checkout.</h1>
          <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-ink-2">
            Passengers can choose an exact seat, confirm trip details, and continue into the same TicketPulse payment and QR delivery flow.
          </p>

          <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            {[
              { label: "Route", value: `${TRANSPORT_DEMO_ROUTE.origin} to ${TRANSPORT_DEMO_ROUTE.destination}`, icon: Route },
              { label: "Pickup and dropoff", value: `${TRANSPORT_DEMO_ROUTE.pickupPoint} to ${TRANSPORT_DEMO_ROUTE.dropoffPoint}`, icon: MapPin },
              { label: "Passenger", value: "Name, email, phone, optional ID", icon: UserRound },
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

        <div className="mt-8">
          <BusSeatPicker />
        </div>
      </section>
    </main>
  )
}
