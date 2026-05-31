"use client"

import Link from "next/link"
import { Check, Circle, Calendar, Ticket, Rocket, ScanLine } from "lucide-react"

interface Step {
  label: string
  desc: string
  href: string
  icon: typeof Calendar
  done: boolean
}

export default function NewOrganizerChecklist({
  hasEvents,
  hasTiers,
  hasPublished,
  hasSales,
  firstEventId,
}: {
  hasEvents: boolean
  hasTiers: boolean
  hasPublished: boolean
  hasSales: boolean
  firstEventId?: string
}) {
  const steps: Step[] = [
    {
      label: "Create your event",
      desc: "Add title, venue, date, and cover image.",
      href: "/organizer/events/new",
      icon: Calendar,
      done: hasEvents,
    },
    {
      label: "Add ticket tiers",
      desc: "Set prices, capacity, and sales windows.",
      href: firstEventId ? `/organizer/events/${firstEventId}/tiers` : "/organizer/events/new",
      icon: Ticket,
      done: hasTiers,
    },
    {
      label: "Publish & share",
      desc: "Go live and share your event link.",
      href: firstEventId ? `/organizer/events/${firstEventId}/edit` : "/organizer/events/new",
      icon: Rocket,
      done: hasPublished,
    },
    {
      label: "Track & scan",
      desc: "Monitor sales and scan tickets at the gate.",
      href: firstEventId ? `/organizer/events/${firstEventId}/live` : "/organizer/scan",
      icon: ScanLine,
      done: hasSales,
    },
  ]

  const completed = steps.filter((s) => s.done).length
  const pct = Math.round((completed / steps.length) * 100)

  return (
    <div className="rounded-2xl border border-line bg-paper overflow-hidden">
      <div className="px-5 md:px-6 py-4 border-b border-line">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-[16px] font-semibold tracking-tight text-ink">Getting started</h2>
            <p className="text-[13px] text-ink-3 mt-0.5">
              {completed === steps.length
                ? "You're all set! Your event is live and ready."
                : `${completed} of ${steps.length} completed`}
            </p>
          </div>
          <span className="text-[13px] font-bold text-ink tabular-nums">{pct}%</span>
        </div>
        <div className="h-1.5 bg-paper-2 rounded-full overflow-hidden mt-3">
          <div
            className="h-full bg-brand-600 rounded-full transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <div className="divide-y divide-line">
        {steps.map((step, i) => {
          const Icon = step.icon
          return (
            <Link
              key={step.label}
              href={step.href}
              className={`flex items-start gap-4 px-5 md:px-6 py-4 transition-colors ${
                step.done ? "bg-paper" : "bg-paper hover:bg-paper-2"
              }`}
            >
              <span
                className={`mt-0.5 inline-flex w-8 h-8 items-center justify-center rounded-lg shrink-0 ${
                  step.done
                    ? "bg-green-50 ring-1 ring-green-500/20"
                    : "bg-paper-2 ring-1 ring-line"
                }`}
              >
                {step.done ? (
                  <Check size={15} className="text-brand-600" />
                ) : (
                  <Icon size={15} className="text-ink-2" />
                )}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[14px] font-semibold tracking-tight ${
                      step.done ? "text-ink-2 line-through" : "text-ink"
                    }`}
                  >
                    {step.label}
                  </span>
                  {!step.done && (
                    <span className="text-[10px] font-semibold tracking-wide uppercase bg-blue/10 text-blue px-1.5 py-0.5 rounded">
                      Step {i + 1}
                    </span>
                  )}
                </div>
                <p className={`text-[13px] mt-0.5 ${step.done ? "text-ink-3" : "text-ink-2"}`}>
                  {step.desc}
                </p>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
