import { CheckCircle2, Wallet } from "lucide-react"

import { TRANSPORT_DEMO_PAYOUT } from "@/lib/transport-demo"

export default function TransportPayoutsPage() {
  const cards = [
    { label: "Gross transport sales", value: `$${TRANSPORT_DEMO_PAYOUT.gross}` },
    { label: "TicketPulse fee", value: `-$${TRANSPORT_DEMO_PAYOUT.platformFee.toFixed(2)}` },
    { label: "Net earned", value: `$${TRANSPORT_DEMO_PAYOUT.netEarned.toFixed(2)}` },
    { label: "Paid out", value: `$${TRANSPORT_DEMO_PAYOUT.paidOut}` },
    { label: "Available balance", value: `$${TRANSPORT_DEMO_PAYOUT.available.toFixed(2)}` },
  ]

  return (
    <main className="min-h-screen bg-paper px-5 py-10 md:px-8">
      <div className="mx-auto max-w-6xl">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-blue">Transport payouts</p>
        <h1 className="text-[30px] font-bold tracking-tight text-ink md:text-[42px]">Revenue less platform fees, ready for settlement.</h1>
        <div className="mt-6 grid gap-4 md:grid-cols-5">
          {cards.map((card) => (
            <div key={card.label} className="rounded-2xl border border-line bg-paper p-5">
              <Wallet size={16} className="mb-3 text-navy" />
              <p className="text-[12px] text-ink-3">{card.label}</p>
              <p className="mt-2 text-[24px] font-bold text-ink">{card.value}</p>
            </div>
          ))}
        </div>
        <div className="mt-6 rounded-2xl border border-line bg-paper-2 p-5">
          <p className="inline-flex items-center gap-2 text-[14px] font-semibold text-ink">
            <CheckCircle2 size={16} className="text-green-600" /> Settlement method: bank or EcoCash, depending on verified operator profile.
          </p>
        </div>
      </div>
    </main>
  )
}
