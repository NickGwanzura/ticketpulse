import { redirect } from "next/navigation"
import { Mail, Paintbrush, Code2, Bell, FlaskConical } from "lucide-react"
import { requireEventAccess } from "@/lib/event-access"
import PageHeader from "@/components/dashboard/PageHeader"

export const metadata = { title: "Email Templates" }

const FEATURES = [
  { icon: Paintbrush,   text: "Brand your confirmation, reminder, and follow-up emails" },
  { icon: Code2,        text: "Use smart variables: attendee name, ticket type, QR code" },
  { icon: Bell,         text: "Schedule pre-event reminders and post-event follow-ups" },
  { icon: FlaskConical, text: "A/B test subject lines" },
]

export default async function EmailTemplatesPage({
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
        title="Email Templates"
        subtitle="Customize the emails your attendees receive."
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
                  <Mail size={32} className="text-amber-600" />
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <h2 className="text-[22px] md:text-[26px] font-bold tracking-tight text-ink mb-2">
                  Custom Email Templates
                </h2>
                <p className="text-[15px] text-ink-2 leading-relaxed mb-8">
                  Every email your attendees receive — from order confirmation to event-day
                  reminders — will be fully customizable. Add your logo, brand colours, and
                  personal copy so every touchpoint feels on-brand.
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

                {/* Interim note */}
                <div className="rounded-xl border border-line bg-paper-2 px-5 py-4">
                  <p className="text-[13px] text-ink-2">
                    In the meantime, use the{" "}
                    <a
                      href={`/organizer/events/${id}/email`}
                      className="font-medium text-navy hover:underline"
                    >
                      Email tool
                    </a>{" "}
                    to send one-off campaigns to your attendees.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
