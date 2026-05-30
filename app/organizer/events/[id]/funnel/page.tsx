import { auth } from "@/auth"
import { redirect, notFound } from "next/navigation"
import { eq } from "drizzle-orm"
import Link from "next/link"
import { ArrowLeft, TrendingUp, Eye, ShoppingCart, CreditCard, CheckCircle, XCircle } from "lucide-react"

import { db } from "@/db"
import { events } from "@/db/schema"
import { requireEventAccess } from "@/lib/event-access"
import { getFunnelStats } from "@/lib/analytics"

export const metadata = { title: "Sales funnel" }

type RouteParams = { id: string }

export default async function FunnelPage({ params }: { params: Promise<RouteParams> }) {
  const { id } = await params

  const session = await auth()
  if (!session) redirect(`/auth/signin?callbackUrl=/organizer/events/${id}/funnel`)

  const access = await requireEventAccess(id)
  if (!access.allowed) redirect(access.redirectTo)

  const [event] = await db
    .select({ title: events.title, slug: events.slug })
    .from(events)
    .where(eq(events.id, id))
    .limit(1)

  if (!event) notFound()

  const stats = await getFunnelStats({ eventId: id, days: 90 })
  const { raw, funnel, conversions, paymentBreakdown } = stats

  return (
    <div className="tp-fade-up">
      <div className="max-w-5xl mx-auto px-5 md:px-8 py-8 md:py-10 space-y-8">
        {/* Back + title */}
        <div className="flex items-center gap-3">
          <Link
            href={`/organizer/events/${id}`}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-paper text-ink-3 hover:text-ink hover:border-line-2 transition-colors"
          >
            <ArrowLeft size={14} />
          </Link>
          <div>
            <p className="text-[11.5px] font-semibold text-ink-3 tracking-widest uppercase">Sales funnel</p>
            <h1 className="text-[20px] font-bold text-ink">{event.title}</h1>
          </div>
        </div>

        {/* KPI strip */}
        {raw.views > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 md:gap-4">
            <div className="rounded-2xl border border-line bg-paper p-4 tp-lift">
              <div className="flex items-center gap-2 mb-2">
                <Eye size={13} className="text-ink-3" />
                <span className="text-[11px] text-ink-3">Views</span>
              </div>
              <p className="text-[22px] font-bold tracking-tight tabular-nums">{raw.views.toLocaleString()}</p>
            </div>
            <div className="rounded-2xl border border-line bg-paper p-4 tp-lift">
              <div className="flex items-center gap-2 mb-2">
                <ShoppingCart size={13} className="text-ink-3" />
                <span className="text-[11px] text-ink-3">Checkouts</span>
              </div>
              <p className="text-[22px] font-bold tracking-tight tabular-nums">{raw.checkoutStarts.toLocaleString()}</p>
            </div>
            <div className="rounded-2xl border border-line bg-paper p-4 tp-lift">
              <div className="flex items-center gap-2 mb-2">
                <CreditCard size={13} className="text-ink-3" />
                <span className="text-[11px] text-ink-3">Payments</span>
              </div>
              <p className="text-[22px] font-bold tracking-tight tabular-nums">{raw.confirmed.toLocaleString()}</p>
            </div>
            <div className="rounded-2xl border border-line bg-paper p-4 tp-lift">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle size={13} className="text-ink-3" />
                <span className="text-[11px] text-ink-3">Tickets issued</span>
              </div>
              <p className="text-[22px] font-bold tracking-tight tabular-nums">{raw.issued.toLocaleString()}</p>
            </div>
          </div>
        )}

        {raw.views === 0 ? (
          <div className="rounded-2xl border border-line bg-paper p-10 text-center">
            <TrendingUp size={32} className="mx-auto mb-3 text-ink-3" />
            <h2 className="text-[16px] font-semibold text-ink">No data yet</h2>
            <p className="text-[12.5px] text-ink-3 mt-1">Funnel data will appear once buyers start visiting this event.</p>
          </div>
        ) : (
          <>
            {/* Funnel bars */}
            <div className="rounded-2xl border border-line bg-paper overflow-hidden">
              <div className="px-5 md:px-6 py-4 border-b border-line">
                <h2 className="text-[15px] font-semibold tracking-tight text-ink">Conversion funnel</h2>
                <p className="text-[11px] text-ink-3 mt-0.5">Last 90 days</p>
              </div>
              <div className="px-5 md:px-6 py-6 space-y-3">
                {funnel.map((stage, i) => {
                  if (i === 0) {
                    return (
                      <div key={stage.stage} className="flex items-center gap-4">
                        <span className="w-36 shrink-0 text-[12.5px] text-ink font-medium">{stage.stage}</span>
                        <div className="flex-1 h-[26px] bg-navy/10 rounded-lg flex items-center px-3">
                          <span className="text-[12.5px] font-bold tabular-nums text-navy">{stage.count.toLocaleString()}</span>
                        </div>
                      </div>
                    )
                  }
                  const barPct = Math.max(4, Math.round((stage.count / funnel[0].count) * 100))
                  return (
                    <div key={stage.stage} className="flex items-center gap-4">
                      <span className="w-36 shrink-0 text-[12.5px] text-ink-2">{stage.stage}</span>
                      <div className="flex-1 h-[26px] bg-paper-2 rounded-lg overflow-hidden relative">
                        <div
                          className="h-full bg-navy/70 rounded-lg flex items-center px-3 transition-all"
                          style={{ width: `${barPct}%` }}
                        >
                          <span className="text-[12.5px] font-bold tabular-nums text-white">{stage.count.toLocaleString()}</span>
                        </div>
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-ink-3 font-medium">
                          {stage.dropoff}%
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Conversion rates */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-4">
              {Object.entries(conversions).map(([label, pct]) => (
                <div key={label} className="rounded-2xl border border-line bg-paper p-4 text-center tp-lift">
                  <p className="text-[26px] font-bold tracking-tight tabular-nums text-navy">{pct}%</p>
                  <p className="text-[11px] text-ink-3 mt-1">{label}</p>
                </div>
              ))}
            </div>

            {/* Payment breakdown */}
            <div className="rounded-2xl border border-line bg-paper overflow-hidden">
              <div className="px-5 md:px-6 py-4 border-b border-line">
                <h2 className="text-[15px] font-semibold tracking-tight text-ink">Payment breakdown</h2>
              </div>
              <div className="px-5 md:px-6 py-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-[13px] text-ink-2">
                    <CheckCircle size={13} className="text-brand-600" />
                    Successful
                  </span>
                  <span className="text-[14px] font-bold tabular-nums text-green-700">{paymentBreakdown.successful.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-[13px] text-ink-2">
                    <XCircle size={13} className="text-rose-500" />
                    Failed
                  </span>
                  <span className="text-[14px] font-bold tabular-nums text-rose-700">{paymentBreakdown.failed.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between border-t border-line pt-3">
                  <span className="flex items-center gap-2 text-[13px] text-ink-2 font-medium">Total</span>
                  <span className="text-[14px] font-bold tabular-nums text-ink">{(paymentBreakdown.successful + paymentBreakdown.failed).toLocaleString()}</span>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
