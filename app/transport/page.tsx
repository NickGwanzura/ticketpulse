import type { Metadata } from "next"
import Link from "next/link"
import {
  ArrowRight,
  Bus,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  CreditCard,
  MapPin,
  QrCode,
  Route,
  ShieldCheck,
  Smartphone,
  Users,
  Wallet,
} from "lucide-react"

export const metadata: Metadata = {
  title: "Transport ticketing",
  description: "Passenger transport ticketing, QR boarding, manifests, fleet operations, and payouts on TicketPulse.",
  alternates: { canonical: "/transport" },
}

const PASSENGER_BENEFITS = [
  { title: "Book seats online", body: "Buy intercity or event shuttle seats with the same fast TicketPulse checkout.", icon: Smartphone },
  { title: "Instant boarding pass", body: "Passengers receive a QR ticket by email, ready for phone-screen or printed validation.", icon: QrCode },
  { title: "Clear trip details", body: "Departure point, time, route notes, and support contact stay attached to the order.", icon: MapPin },
]

const OPERATOR_BENEFITS = [
  { title: "Routes and departures", body: "Create routes, schedule departures, set prices, and control capacity.", icon: Route },
  { title: "Passenger manifests", body: "Dispatchers and crew get paid passenger lists, check-in status, and no-show tools.", icon: ClipboardList },
  { title: "QR boarding", body: "Drivers or conductors scan boarding passes and block duplicate use.", icon: ShieldCheck },
  { title: "Revenue and payouts", body: "Track confirmed sales, platform fees, paid settlements, and available balance.", icon: Wallet },
]

const FLOW = [
  { label: "Operator creates route", icon: Route },
  { label: "Passenger pays", icon: CreditCard },
  { label: "QR pass delivered", icon: QrCode },
  { label: "Crew scans at boarding", icon: Bus },
  { label: "Payout reconciled", icon: Wallet },
]

export default function TransportPage() {
  return (
    <div className="tp-fade-up">
      <section className="relative overflow-hidden border-b border-line bg-paper">
        <div className="mx-auto grid max-w-7xl gap-10 px-5 py-14 md:grid-cols-[1.05fr_0.95fr] md:px-8 md:py-20">
          <div className="flex flex-col justify-center">
            <div className="mb-6 inline-flex w-fit items-center gap-2 rounded-full border border-line bg-paper-2 px-3 py-1.5">
              <Bus size={13} className="text-brand-600" />
              <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink">Passenger transport</span>
            </div>
            <h1 className="max-w-3xl text-[40px] font-bold leading-[1.04] tracking-[-0.025em] text-ink md:text-[64px]">
              Transport ticketing, built into TicketPulse.
            </h1>
            <p className="mt-5 max-w-2xl text-[16px] leading-relaxed text-ink-2 md:text-[18px]">
              Sell bus, kombi, shuttle, and event transport tickets from the same platform that handles checkout, QR validation, manifests, revenue, and payouts.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href="/events"
                className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-3 text-[14px] font-semibold text-white shadow-sm shadow-brand-600/20 hover:bg-brand-700 active:scale-[0.99] transition"
              >
                Find trips <ArrowRight size={14} />
              </Link>
              <Link
                href="/auth/signup?role=organizer"
                className="inline-flex items-center gap-2 rounded-xl border border-line bg-paper px-5 py-3 text-[14px] font-semibold text-ink hover:border-line-2 transition"
              >
                Partner with us
              </Link>
              <Link
                href="#demo-ticket"
                className="inline-flex items-center gap-2 rounded-xl border border-line bg-paper px-5 py-3 text-[14px] font-semibold text-ink hover:border-line-2 transition"
              >
                View demo ticket
              </Link>
            </div>
          </div>

          <div className="relative min-h-[420px] overflow-hidden rounded-3xl border border-line bg-ink text-white shadow-lg shadow-ink/10">
            <img
              src="/transport/luxury-buses.png"
              alt="Luxury intercity buses ready for passenger boarding"
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-ink/20" />
            <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/35 to-transparent" />
            <div className="relative flex h-full min-h-[420px] flex-col justify-end p-5 md:p-7">
              <div className="max-w-md rounded-2xl border border-white/20 bg-ink/78 p-4 shadow-2xl shadow-ink/30 backdrop-blur-md">
                <div className="mb-4 flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/60">Live route preview</p>
                    <h2 className="mt-1 text-[22px] font-bold tracking-tight">Harare to Bulawayo</h2>
                  </div>
                  <span className="shrink-0 rounded-full bg-white px-3 py-1 text-[12px] font-bold text-ink">Paid</span>
                </div>

                <div className="grid gap-2 text-[13px] text-white/80">
                  <div className="flex items-center justify-between gap-4 rounded-xl bg-white/10 px-3 py-2">
                    <span className="inline-flex items-center gap-2"><CalendarClock size={14} /> Today, 14:30</span>
                    <span className="font-semibold text-white">Seat 12A</span>
                  </div>
                  <div className="flex items-center justify-between gap-4 rounded-xl bg-white/10 px-3 py-2">
                    <span className="inline-flex items-center gap-2"><Users size={14} /> Manifest ready</span>
                    <span className="font-semibold text-white">QR valid</span>
                  </div>
                </div>

                <div className="mt-4 flex items-end justify-between gap-4">
                  <div>
                    <p className="text-[11px] text-white/60">Operator settlement</p>
                    <p className="mt-0.5 text-[18px] font-bold">$0.95 net per $1 ticket</p>
                  </div>
                  <div className="grid h-16 w-16 shrink-0 place-items-center rounded-xl bg-white text-ink">
                    <QrCode size={36} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="demo-ticket" className="border-b border-line bg-paper">
        <div className="mx-auto grid max-w-7xl gap-8 px-5 py-14 md:grid-cols-[0.9fr_1.1fr] md:px-8 md:py-18">
          <div className="flex flex-col justify-center">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-blue">Demo ticket</p>
            <h2 className="max-w-lg text-[28px] font-bold tracking-tight text-ink md:text-[36px] md:leading-tight">Test the passenger flow with a sample boarding pass.</h2>
            <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-ink-2">
              This demo shows what a paid transport ticket will look like after checkout: route details, seat, manifest status, and a QR-style boarding block. It is not a real ticket and will not admit a passenger.
            </p>
            <div className="mt-6 grid gap-3 text-[14px] text-ink-2">
              {[
                "Passenger buys a seat and receives this pass.",
                "Crew scans the QR at boarding.",
                "Manifest updates to checked in or duplicate scan.",
              ].map((item) => (
                <div key={item} className="flex items-start gap-2">
                  <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-brand-600" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="min-w-0 rounded-3xl border border-line bg-paper-2 p-4 md:p-5">
            <div className="overflow-hidden rounded-2xl border border-line bg-paper shadow-sm shadow-ink/[0.04]">
              <div className="flex items-start justify-between gap-4 border-b border-line bg-ink p-5 text-white">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/60">TicketPulse demo</p>
                  <h3 className="mt-2 text-[22px] font-bold tracking-tight md:text-[24px]">Transport boarding pass</h3>
                </div>
                <span className="shrink-0 rounded-full bg-white px-3 py-1 text-[12px] font-bold text-ink">Demo</span>
              </div>

              <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_220px] md:p-6">
                <div className="min-w-0 space-y-5">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-3">Route</p>
                    <p className="mt-1 text-[22px] font-bold tracking-tight text-ink md:text-[24px]">Harare to Bulawayo</p>
                    <p className="mt-1 flex items-start gap-1.5 text-[13px] leading-relaxed text-ink-3">
                      <MapPin size={14} /> Roadport, Harare to City Hall, Bulawayo
                    </p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    {[
                      { label: "Departure", value: "Today, 14:30", icon: CalendarClock },
                      { label: "Seat", value: "12A", icon: Users },
                      { label: "Reference", value: "TP-TR-DMO1", icon: ClipboardList },
                      { label: "Status", value: "Paid demo", icon: ShieldCheck },
                    ].map(({ label, value, icon: Icon }) => (
                      <div key={label} className="flex min-w-0 items-center gap-3 rounded-2xl border border-line bg-paper-2 p-3.5">
                        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-paper text-ink-3 ring-1 ring-line">
                          <Icon size={16} />
                        </span>
                        <div className="min-w-0">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-3">{label}</p>
                          <p className="mt-0.5 whitespace-nowrap text-[13px] font-bold leading-snug text-ink sm:text-[14px]">{value}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="rounded-2xl border border-green-500/20 bg-green-50 p-4">
                    <p className="text-[13px] font-semibold text-green-800">Scan preview</p>
                    <p className="mt-1 text-[13px] leading-relaxed text-green-700">
                      First scan: valid demo boarding pass. Second scan: duplicate warning. Invalid or expired passes are rejected.
                    </p>
                  </div>
                </div>

                <div className="flex min-h-full flex-col justify-between gap-4 rounded-2xl border border-line bg-white p-4 text-center">
                  <div className="mx-auto grid h-36 w-36 place-items-center rounded-2xl border border-line bg-paper text-ink">
                    <QrCode size={82} />
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-3">Demo QR</p>
                    <p className="mt-1 text-[12px] leading-relaxed text-ink-3">
                      Visual sample only. Real QR codes are generated after confirmed payment.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-14 md:px-8 md:py-18">
        <div className="mb-8 max-w-2xl">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-blue">For passengers</p>
          <h2 className="text-[28px] font-bold tracking-tight text-ink md:text-[40px]">Simple trip buying with proper proof of travel.</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {PASSENGER_BENEFITS.map(({ title, body, icon: Icon }) => (
            <article key={title} className="rounded-2xl border border-line bg-paper p-6">
              <Icon size={20} className="mb-4 text-brand-600" />
              <h3 className="text-[16px] font-semibold text-ink">{title}</h3>
              <p className="mt-2 text-[14px] leading-relaxed text-ink-2">{body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="border-y border-line bg-paper-2">
        <div className="mx-auto max-w-7xl px-5 py-14 md:px-8 md:py-18">
          <div className="mb-8 max-w-2xl">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-blue">For transport operators</p>
            <h2 className="text-[28px] font-bold tracking-tight text-ink md:text-[40px]">Run ticketing, boarding, manifests, and settlement in one place.</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-4">
            {OPERATOR_BENEFITS.map(({ title, body, icon: Icon }) => (
              <article key={title} className="rounded-2xl border border-line bg-paper p-6">
                <Icon size={20} className="mb-4 text-navy" />
                <h3 className="text-[16px] font-semibold text-ink">{title}</h3>
                <p className="mt-2 text-[14px] leading-relaxed text-ink-2">{body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-14 md:px-8 md:py-18">
        <div className="rounded-3xl border border-line bg-paper p-6 md:p-8">
          <div className="mb-6 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-blue">How it flows</p>
              <h2 className="text-[24px] font-bold tracking-tight text-ink md:text-[32px]">One shared engine for events and transport.</h2>
            </div>
            <span className="inline-flex w-fit items-center gap-2 rounded-full bg-green-50 px-3 py-1.5 text-[12px] font-semibold text-green-700">
              <CheckCircle2 size={14} /> No separate app
            </span>
          </div>
          <div className="grid gap-3 md:grid-cols-5">
            {FLOW.map(({ label, icon: Icon }, index) => (
              <div key={label} className="rounded-2xl border border-line bg-paper-2 p-4">
                <span className="mb-4 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-paper text-navy ring-1 ring-line">
                  <Icon size={17} />
                </span>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-3">Step {index + 1}</p>
                <p className="mt-1 text-[14px] font-semibold text-ink">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
