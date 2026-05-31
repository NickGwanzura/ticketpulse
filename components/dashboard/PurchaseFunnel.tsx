import { db } from "@/db"
import { orders, tickets } from "@/db/schema"
import { eq, inArray, sql, and } from "drizzle-orm"
import { ShoppingCart, CreditCard, CheckCircle, MailCheck, ScanLine } from "lucide-react"

// ─── Types ───────────────────────────────────────────────────────────────────

interface FunnelStage {
  key: string
  label: string
  icon: React.ElementType
  count: number
  pct: number // percentage of first stage
  dropPct: number | null // drop-off from previous stage
}

interface Props {
  eventIds?: string[]
}

// ─── Component ───────────────────────────────────────────────────────────────

export default async function PurchaseFunnel({ eventIds }: Props) {
  const where = eventIds && eventIds.length > 0
    ? inArray(orders.eventId, eventIds)
    : undefined

  // Single query — count orders at each stage
  const [row] = await db
    .select({
      total: sql<number>`COUNT(*)::int`,
      hasPayment: sql<number>`COUNT(*) FILTER (WHERE ${orders.paymentMethod} IS NOT NULL)::int`,
      paid: sql<number>`COUNT(*) FILTER (WHERE ${orders.status} IN ('paid', 'awaiting_verification'))::int`,
      verified: sql<number>`COUNT(*) FILTER (WHERE ${orders.verifiedAt} IS NOT NULL)::int`,
    })
    .from(orders)
    .where(where)

  // Count attended tickets linked to these orders
  const orderIds = await db
    .select({ id: orders.id })
    .from(orders)
    .where(where)

  const ids = orderIds.map((o) => o.id)
  let attended = 0
  if (ids.length > 0) {
    const [attRow] = await db
      .select({
        count: sql<number>`COUNT(DISTINCT ${tickets.orderId})::int`,
      })
      .from(tickets)
      .where(and(
        inArray(tickets.orderId, ids),
        sql`${tickets.scannedAt} IS NOT NULL`,
      ))
    attended = attRow?.count ?? 0
  }

  const stages: FunnelStage[] = [
    { key: "checkout", label: "Checkout started", icon: ShoppingCart, count: row?.total ?? 0, pct: 100, dropPct: null },
    { key: "payment", label: "Payment method", icon: CreditCard, count: row?.hasPayment ?? 0, pct: 0, dropPct: null },
    { key: "paid", label: "Paid", icon: CheckCircle, count: row?.paid ?? 0, pct: 0, dropPct: null },
    { key: "verified", label: "Email verified", icon: MailCheck, count: row?.verified ?? 0, pct: 0, dropPct: null },
    { key: "attended", label: "Attended", icon: ScanLine, count: attended, pct: 0, dropPct: null },
  ]

  const firstCount = stages[0].count
  for (let i = 0; i < stages.length; i++) {
    stages[i].pct = firstCount > 0 ? Math.round((stages[i].count / firstCount) * 100) : 0
    if (i > 0) {
      const prev = stages[i - 1].count
      stages[i].dropPct = prev > 0
        ? Math.round(((prev - stages[i].count) / prev) * 100)
        : 0
    }
  }

  if (firstCount === 0) {
    return (
      <div className="rounded-2xl border border-line bg-paper p-5 md:p-6">
        <h3 className="text-[15px] font-semibold tracking-tight text-ink mb-1">Purchase journey funnel</h3>
        <p className="text-[13px] text-ink-3 mb-5">Where attendees drop off between checkout and entry.</p>
        <div className="text-center py-10">
          <div className="inline-flex w-12 h-12 items-center justify-center rounded-2xl bg-paper ring-1 ring-line mb-4">
            <ShoppingCart size={19} className="text-ink-3" />
          </div>
          <p className="text-[15px] font-semibold text-ink">No orders yet</p>
          <p className="mt-1.5 text-[13px] text-ink-2 max-w-sm mx-auto leading-relaxed">
            Funnel data will appear once attendees start placing orders.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-line bg-paper p-5 md:p-6">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-[15px] font-semibold tracking-tight text-ink">Purchase journey funnel</h3>
      </div>
      <p className="text-[13px] text-ink-3 mb-5">Where attendees drop off between checkout and entry.</p>

      <div className="space-y-3">
        {stages.map((s, i) => {
          const Icon = s.icon
          const barWidth = Math.max(s.pct, 4) // minimum 4% so tiny bars are still visible
          const drop = s.dropPct
          return (
            <div key={s.key}>
              <div className="flex items-center gap-3 mb-1.5">
                <span className="inline-flex w-7 h-7 items-center justify-center rounded-lg bg-paper-2 ring-1 ring-line shrink-0">
                  <Icon size={13} className="text-ink-2" />
                </span>
                <span className="text-[13px] font-medium text-ink flex-1 min-w-0">{s.label}</span>
                <span className="text-[14px] font-bold tabular-nums text-ink">{s.count.toLocaleString()}</span>
                <span className="text-[11px] text-ink-3 w-10 text-right tabular-nums">{s.pct}%</span>
              </div>

              {/* Funnel bar */}
              <div className="relative h-2 bg-paper-2 rounded-full overflow-hidden ml-10">
                <div
                  className="absolute inset-y-0 left-0 rounded-full bg-navy/80 transition-all"
                  style={{ width: `${barWidth}%` }}
                />
              </div>

              {/* Drop-off indicator */}
              {drop !== null && drop > 0 && (
                <p className="text-[11px] text-ink-3 mt-0.5 ml-10 flex items-center gap-1">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-rose-300" />
                  {drop}% dropped off
                </p>
              )}
            </div>
          )
        })}
      </div>

      {/* Summary insight */}
      {firstCount > 0 && (
        <div className="mt-5 pt-4 border-t border-line">
          <p className="text-[12px] text-ink-3 leading-relaxed">
            <span className="font-semibold text-ink">{stages[stages.length - 1].count.toLocaleString()}</span> of{' '}
            <span className="font-semibold text-ink">{firstCount.toLocaleString()}</span> attendees who started checkout{' '}
            made it through to entry{' '}
            <span className="text-ink-2">({stages[stages.length - 1].pct}% conversion)</span>.
            {stages[1].dropPct && stages[1].dropPct > 30
              ? ` The biggest drop-off is at the payment stage (${stages[1].dropPct}% leave before selecting a method).`
              : stages[2].dropPct && stages[2].dropPct > 30
              ? ` The biggest drop-off is at payment completion (${stages[2].dropPct}% don't complete payment).`
              : ''}
          </p>
        </div>
      )}
    </div>
  )
}
