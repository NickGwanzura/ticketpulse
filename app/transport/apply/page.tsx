import Link from "next/link"
import { ArrowRight, Banknote, Bus, CheckCircle2, FileCheck2, MapPin, Phone, ShieldCheck, UserRound } from "lucide-react"

import { TRANSPORT_DEMO_OPERATOR, TRANSPORT_POPULAR_ROUTES } from "@/lib/transport-demo"

const fields = [
  { label: "Company name", value: TRANSPORT_DEMO_OPERATOR.companyName, icon: Bus },
  { label: "Contact person", value: TRANSPORT_DEMO_OPERATOR.contactPerson, icon: UserRound },
  { label: "Phone", value: TRANSPORT_DEMO_OPERATOR.phone, icon: Phone },
  { label: "Email", value: TRANSPORT_DEMO_OPERATOR.email, icon: FileCheck2 },
  { label: "Routes served", value: TRANSPORT_POPULAR_ROUTES.slice(0, 3).join(", "), icon: MapPin },
  { label: "Vehicle types", value: "Luxury coach, kombi, shuttle", icon: Bus },
  { label: "Payout details", value: TRANSPORT_DEMO_OPERATOR.payoutMethod, icon: Banknote },
  { label: "Verification", value: TRANSPORT_DEMO_OPERATOR.verificationStatus, icon: ShieldCheck },
]

export default function TransportApplyPage() {
  return (
    <main className="min-h-screen bg-paper">
      <section className="border-b border-line bg-paper-2">
        <div className="mx-auto max-w-6xl px-5 py-10 md:px-8">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-blue">Transport onboarding</p>
          <h1 className="text-[30px] font-bold tracking-tight text-ink md:text-[42px]">Register a transport operator.</h1>
          <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-ink-2">
            Operators submit company details, routes served, vehicle types, payout details, and verification documents before selling seats.
          </p>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-6 px-5 py-8 md:grid-cols-[1fr_0.75fr] md:px-8">
        <div className="rounded-2xl border border-line bg-paper p-5 md:p-6">
          <h2 className="text-[20px] font-semibold text-ink">Operator profile preview</h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {fields.map(({ label, value, icon: Icon }) => (
              <div key={label} className="rounded-xl border border-line bg-paper-2 p-4">
                <Icon size={16} className="mb-3 text-navy" />
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-3">{label}</p>
                <p className="mt-1 text-[14px] font-semibold leading-snug text-ink">{value}</p>
              </div>
            ))}
          </div>
        </div>

        <aside className="rounded-2xl border border-line bg-ink p-5 text-white md:p-6">
          <ShieldCheck size={22} className="mb-4 text-white/80" />
          <h2 className="text-[22px] font-bold tracking-tight">Verification checklist</h2>
          <div className="mt-5 space-y-3">
            {["Company contact verified", "Vehicle documents uploaded", "Bank/EcoCash settlement captured", "Route approval pending"].map((item) => (
              <div key={item} className="flex items-center gap-2 text-[13px] text-white/80">
                <CheckCircle2 size={15} className="text-green-300" />
                {item}
              </div>
            ))}
          </div>
          <Link href="/transport/routes" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-[13px] font-semibold text-ink">
            Continue to routes <ArrowRight size={14} />
          </Link>
        </aside>
      </section>
    </main>
  )
}
