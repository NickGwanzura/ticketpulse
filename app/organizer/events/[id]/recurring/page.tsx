import { redirect } from "next/navigation"
import Link from "next/link"
import { CalendarDays, Link2, Users, Send, QrCode, ArrowRight } from "lucide-react"
import { requireEventAccess } from "@/lib/event-access"
import PageHeader from "@/components/dashboard/PageHeader"

export const metadata = { title: "Recurring Events" }

const FEATURES = [
  { icon: Link2,   text: "Link all dates under one event page" },
  { icon: Users,   text: "Manage capacity per date" },
  { icon: Send,    text: "Send targeted comms to each date's attendees" },
  { icon: QrCode,  text: "Generate per-date QR tickets" },
]

export default async function RecurringPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const access = await requireEventAccess(id)
  if (!access.allowed) redirect(access.redirectTo)

  return (
    <div className="tp-fade-up">
      <PageHeader
        eyebrow="Event settings"
        title="Recurring Events"
        subtitle="Set up repeating events with one creation."
      />

      <div className="max-w-5xl mx-auto px-5 md:px-8 py-10 md:py-14">
        <div className="rounded-2xl border border-line bg-paper overflow-hidden">
          {/* Top accent bar */}
          <div className="h-1 bg-gradient-to-r from-amber-400 to-amber-300" />

          <div className="p-6 md:p-10">
            {/* Badge */}
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-[11px] font-semibold text-amber-700 ring-1 ring-amber-200 mb-6">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
              </span>
              Coming soon
            </span>

            <div className="flex flex-col md:flex-row md:items-start gap-8">
              {/* Icon column */}
              <div className="shrink-0">
                <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50 ring-1 ring-amber-200">
                  <CalendarDays size={32} className="text-amber-600" />
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <h2 className="text-[22px] md:text-[26px] font-bold tracking-tight text-ink mb-2">
                  Recurring Events
                </h2>
                <p className="text-[15px] text-ink-2 leading-relaxed mb-8">
                  Create events that repeat daily, weekly, monthly, or on custom dates — all managed
                  from a single event page so your audience sees the full schedule and you only set
                  things up once.
                </p>

                {/* Feature list */}
                <div className="grid sm:grid-cols-2 gap-3 mb-8">
                  {FEATURES.map(({ icon: Icon, text }) => (
                    <div
                      key={text}
                      className="flex items-start gap-3 rounded-xl bg-paper-2 border border-line px-4 py-3"
                    >
                      <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-amber-50 ring-1 ring-amber-200">
                        <Icon size={13} className="text-amber-600" />
                      </span>
                      <span className="text-[13px] text-ink-2 leading-snug">{text}</span>
                    </div>
                  ))}
                </div>

                {/* CTA */}
                <div className="rounded-xl border border-line bg-paper-2 px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <p className="text-[13px] text-ink-2">
                    In the meantime, create each date as a separate event.
                  </p>
                  <Link
                    href="/organizer/events/new"
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-ink px-4 py-2.5 text-[13px] font-semibold text-paper hover:bg-ink/85 transition-colors"
                  >
                    Create new event <ArrowRight size={13} />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
