import { redirect } from "next/navigation"
import Link from "next/link"
import { sql } from "drizzle-orm"
import { CheckCircle2 } from "lucide-react"

import { auth } from "@/auth"
import { db } from "@/db"
import PageHeader from "@/components/dashboard/PageHeader"
import EmptyState from "@/components/dashboard/EmptyState"
import SyncCounterButton from "./SyncCounterButton"

export const dynamic = "force-dynamic"

type Row = {
  tier_id: string
  event_id: string
  event: string
  tier: string
  capacity: number
  counter: number
  live_tickets: number
  held_open: number
  expected: number
  verdict: "OVERSOLD" | "DRIFT" | "ok"
}

/**
 * Read-only. Compares each tier's sold counter with the tickets that really
 * exist (not cancelled/refunded/staff) plus stock held by open reserved orders.
 * A counter below the real number is what lets sold-out tickets go on sale again.
 */
async function loadTiers(): Promise<Row[]> {
  const result = await db.execute(sql`
    SELECT tt.id AS tier_id, e.id AS event_id, e.title AS event, tt.name AS tier,
      tt.total_quantity::int AS capacity, COALESCE(tt.sold_quantity, 0)::int AS counter,
      t.live_tickets, h.held_open, (t.live_tickets + h.held_open) AS expected,
      CASE WHEN t.live_tickets + h.held_open > tt.total_quantity THEN 'OVERSOLD'
           WHEN COALESCE(tt.sold_quantity, 0) <> t.live_tickets + h.held_open THEN 'DRIFT'
           ELSE 'ok' END AS verdict
    FROM ticket_tiers tt
    JOIN events e ON e.id = tt.event_id
    CROSS JOIN LATERAL (
      SELECT COUNT(*)::int AS live_tickets FROM tickets x
      WHERE x.tier_id = tt.id AND COALESCE(x.is_staff_ticket, false) = false
        AND x.status NOT IN ('cancelled', 'refunded')
    ) t
    CROSS JOIN LATERAL (
      SELECT COALESCE(SUM(oi.quantity), 0)::int AS held_open
      FROM order_items oi JOIN orders o ON o.id = oi.order_id
      WHERE oi.tier_id = tt.id AND oi.type = 'ticket'
        AND o.status IN ('pending', 'awaiting_verification')
        AND o.metadata->>'inventoryReserved' = 'true'
        AND NOT EXISTS (SELECT 1 FROM tickets t2 WHERE t2.order_id = o.id)
    ) h
    ORDER BY e.title, tt.name
  `)
  return result.rows as unknown as Row[]
}

export default async function StockAuditPage() {
  const session = await auth()
  if (!session?.user || session.user.role !== "admin") {
    redirect("/auth/signin?callbackUrl=/admin/stock-audit")
  }

  const rows = await loadTiers()
  const problems = rows.filter((r) => r.verdict !== "ok")

  return (
    <div className="tp-fade-up">
      <PageHeader
        eyebrow="Operations"
        title="Stock audit"
        subtitle={`${rows.length} ticket tiers checked, ${problems.length} with problems. Read-only.`}
        width="full"
      />
      <div className="px-5 md:px-8 py-8 md:py-10 space-y-4">
        {problems.length === 0 ? (
          <EmptyState icon={CheckCircle2} title="All tiers match" body="Every sold counter equals the tickets that really exist." variant="inline" />
        ) : (
          <div className="rounded-2xl border border-line bg-paper overflow-x-auto">
            <table className="w-full min-w-[760px]">
              <thead>
                <tr className="border-b border-line text-[11px] font-semibold tracking-widest text-ink-3 uppercase">
                  <th className="text-left px-5 py-3">Event / tier</th>
                  <th className="text-right px-3 py-3">Capacity</th>
                  <th className="text-right px-3 py-3">Counter</th>
                  <th className="text-right px-3 py-3">Real tickets</th>
                  <th className="text-right px-3 py-3">Held (unpaid)</th>
                  <th className="text-right px-3 py-3">Expected</th>
                  <th className="text-right px-3 py-3">Verdict</th>
                  <th className="text-right px-5 py-3">Fix</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {problems.map((r) => (
                  <tr key={`${r.event}-${r.tier}`}>
                    <td className="px-5 py-3">
                      <p className="text-[13px] text-ink">{r.tier}</p>
                      <p className="text-[11px] text-ink-3">{r.event}</p>
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-[13px]">{r.capacity}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-[13px]">{r.counter}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-[13px]">{r.live_tickets}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-[13px]">{r.held_open}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-[13px] font-semibold">{r.expected}</td>
                    <td className="px-3 py-3 text-right">
                      <span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${r.verdict === "OVERSOLD" ? "bg-rose-100 text-rose-800" : "bg-amber-100 text-amber-800"}`}>
                        {r.verdict}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      {r.verdict === "DRIFT" ? (
                        <SyncCounterButton tierId={r.tier_id} expected={r.expected} />
                      ) : (
                        <Link
                          href={`/organizer/events/${r.event_id}/tiers`}
                          className="text-[12px] font-semibold text-brand-600 hover:underline"
                        >
                          Review tier
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-[12px] text-ink-3">
          OVERSOLD needs a decision, so it has no one-click fix: raise the tier's capacity to cover the tickets already sold, or cancel/refund the newest extra orders. DRIFT can be fixed with the button, which recomputes the real number on the server. DRIFT: the sold counter differs from the real count; a counter lower than Expected lets sold-out tickets go back on sale.
        </p>
      </div>
    </div>
  )
}
