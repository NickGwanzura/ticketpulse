import type { TicketTierSales } from "@/lib/ticket-tier-sales"
import { formatCurrency } from "@/lib/utils"

export default function TicketTierSalesBreakdown({ tiers }: { tiers: TicketTierSales[] }) {
  if (tiers.length === 0) return <p className="text-[13px] text-ink-3">No ticket tiers configured yet.</p>

  return (
    <div>
      <ul className="grid gap-3 sm:grid-cols-2">
        {tiers.map(tier => {
          const percent = tier.capacity > 0 ? Math.min(100, Math.round(tier.sold / tier.capacity * 100)) : 0
          return (
            <li key={tier.id} className="min-w-0 rounded-xl border border-line bg-paper p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="text-[14px] font-semibold text-ink break-words">{tier.name}</p>
                <span className="text-[12px] text-ink-3">{formatCurrency(tier.price, tier.currency)} each</span>
              </div>
              <p className="mt-3 text-[22px] font-bold text-ink tabular-nums">
                {tier.sold.toLocaleString()} <span className="text-[13px] font-normal text-ink-2">sold / {tier.capacity.toLocaleString()} capacity</span>
              </p>
              <div role="progressbar" aria-label={`${tier.name} sold`} aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} className="mt-2 h-1.5 overflow-hidden rounded-full bg-paper-2">
                <div className="h-full bg-navy" style={{ width: `${percent}%` }} />
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-[12px]">
                <div><dt className="text-ink-3">Available</dt><dd className="font-semibold text-ink tabular-nums">{tier.remaining.toLocaleString()}</dd></div>
                <div><dt className="text-ink-3">Ticket revenue</dt><dd className="font-semibold text-ink tabular-nums">
                  {(tier.revenueByCurrency?.length ? tier.revenueByCurrency : [{ currency: tier.currency, amount: tier.revenue }]).map(revenue => (
                    <span key={revenue.currency} className="block">{formatCurrency(revenue.amount, revenue.currency)}</span>
                  ))}
                </dd></div>
                {tier.complimentary > 0 && <div><dt className="text-ink-3">Complimentary</dt><dd className="font-semibold text-ink">{tier.complimentary.toLocaleString()}</dd></div>}
                {tier.reserved > 0 && <div><dt className="text-ink-3">Reserved / pending</dt><dd className="font-semibold text-ink">{tier.reserved.toLocaleString()}</dd></div>}
              </dl>
            </li>
          )
        })}
      </ul>
      <p className="mt-3 text-[11px] text-ink-3">Sales count issued tickets on confirmed orders. Revenue includes direct sales and discounts, before platform fees. Complimentary tickets are shown separately.</p>
    </div>
  )
}
