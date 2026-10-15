import "server-only"

import { unstable_cache } from "next/cache"
import { and, eq, inArray, notInArray, sql } from "drizzle-orm"

import { db } from "@/db"
import { tickets } from "@/db/schema"
import { getEventRevenueSummaries, type EventRevenueSummary } from "@/lib/revenue-summary"
import { getTicketTierSales, type TicketTierSales } from "@/lib/ticket-tier-sales"

/**
 * The organiser dashboard's heavy read-only aggregates, cached for a minute.
 * Balances and payout figures are deliberately NOT cached; they are read live.
 * Arguments are part of the cache key, so each event set is cached separately.
 */
const REVALIDATE_SECONDS = 60

const cachedRevenue = unstable_cache(
  async (eventIds: string[]) => [...(await getEventRevenueSummaries(eventIds)).entries()],
  ["organizer-dashboard-revenue"],
  { revalidate: REVALIDATE_SECONDS },
)

const cachedTierSales = unstable_cache(
  async (eventIds: string[]) => [...(await getTicketTierSales(eventIds)).entries()],
  ["organizer-dashboard-tier-sales"],
  { revalidate: REVALIDATE_SECONDS },
)

export async function getDashboardRevenue(eventIds: string[]): Promise<Map<string, EventRevenueSummary>> {
  if (eventIds.length === 0) return new Map()
  return new Map(await cachedRevenue([...eventIds].sort()))
}

export async function getDashboardTierSales(eventIds: string[]): Promise<Map<string, TicketTierSales[]>> {
  if (eventIds.length === 0) return new Map()
  return new Map(await cachedTierSales([...eventIds].sort()))
}

export type SalesTrendDay = { date: string; tickets: number }

const TREND_DAYS = 30

const cachedTrend = unstable_cache(
  async (eventIds: string[]): Promise<SalesTrendDay[]> => {
    // Issued buyer tickets per day, in Zimbabwe time, matching the attendee count.
    const rows = await db
      .select({
        day: sql<string>`to_char((${tickets.createdAt} AT TIME ZONE 'Africa/Harare')::date, 'YYYY-MM-DD')`,
        count: sql<number>`COUNT(*)::int`,
      })
      .from(tickets)
      .where(and(
        inArray(tickets.eventId, eventIds),
        eq(tickets.isStaffTicket, false),
        notInArray(tickets.status, ["cancelled", "refunded"]),
        sql`${tickets.createdAt} >= now() - interval '${sql.raw(String(TREND_DAYS + 1))} days'`,
      ))
      .groupBy(sql`1`)
    const byDay = new Map(rows.map((r) => [r.day, r.count]))
    const out: SalesTrendDay[] = []
    for (let i = TREND_DAYS - 1; i >= 0; i--) {
      // Day labels in Harare time (UTC+2, no DST).
      const d = new Date(Date.now() + 2 * 3_600_000 - i * 86_400_000)
      const key = d.toISOString().slice(0, 10)
      out.push({ date: key, tickets: byDay.get(key) ?? 0 })
    }
    return out
  },
  ["organizer-dashboard-trend"],
  { revalidate: REVALIDATE_SECONDS },
)

export async function getDashboardSalesTrend(eventIds: string[]): Promise<SalesTrendDay[]> {
  if (eventIds.length === 0) return []
  return cachedTrend([...eventIds].sort())
}
