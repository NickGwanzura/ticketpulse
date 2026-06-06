import { Bus, CalendarClock, ClipboardList, Route, ShieldCheck, Users, Wallet } from "lucide-react"

const modules = [
  { title: "Operators", body: "Approve companies, documents, contacts, and payout settings.", icon: ShieldCheck },
  { title: "Routes", body: "Audit route inventory across intercity and event shuttle products.", icon: Route },
  { title: "Fleet", body: "Review vehicles, capacity, registration, and verification status.", icon: Bus },
  { title: "Departures", body: "Monitor scheduled trips, occupancy, cutoff times, and boarding windows.", icon: CalendarClock },
  { title: "Manifests", body: "Access passenger lists for support, disputes, and safety checks.", icon: ClipboardList },
  { title: "Payouts", body: "Reconcile transport revenue, fees, pending payouts, and paid settlements.", icon: Wallet },
]

export default function AdminTransportPage() {
  return (
    <div className="px-5 py-8 md:px-8 md:py-10">
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-blue">Admin</p>
          <h1 className="text-[28px] font-bold tracking-tight text-ink md:text-[36px]">Transport control center</h1>
          <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-ink-2">
            Super-admin visibility for passenger transport ticketing, manifests, QR boarding, settlement, and platform risk.
          </p>
        </div>
        <div className="rounded-2xl border border-line bg-paper p-4">
          <div className="flex items-center gap-2 text-[13px] text-ink-3">
            <Users size={15} />
            Active transport operators
          </div>
          <p className="mt-2 text-[28px] font-bold text-ink">0</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {modules.map(({ title, body, icon: Icon }) => (
          <article key={title} className="rounded-2xl border border-line bg-paper p-5">
            <Icon size={20} className="mb-4 text-navy" />
            <h2 className="text-[16px] font-semibold text-ink">{title}</h2>
            <p className="mt-1 text-[13px] leading-relaxed text-ink-3">{body}</p>
          </article>
        ))}
      </div>
    </div>
  )
}
