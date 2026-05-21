"use client"

import { useEffect, useState, useCallback } from "react"
import { Users, TicketCheck, Percent } from "lucide-react"
import StatCard from "@/components/dashboard/StatCard"

type LiveStats = {
  totalSold: number
  totalCapacity: number
  checkedIn: number
  capacityPct: number
  checkinPct: number
}

type RecentCheckin = {
  code: string
  tierName: string
  holder: string | null
  scannedAt: string
}

export default function LiveDashboardClient({
  eventId,
  initialStats,
}: {
  eventId: string
  initialStats: LiveStats
}) {
  const [stats, setStats] = useState<LiveStats>(initialStats)
  const [recent, setRecent] = useState<RecentCheckin[]>([])

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/events/${eventId}/live/stats`)
      if (res.ok) {
        const data = await res.json()
        setStats(data.stats)
        setRecent(data.recent ?? [])
      }
    } catch {
      // silent — keep last known stats
    }
  }, [eventId])

  useEffect(() => {
    const interval = setInterval(refresh, 30_000)
    // Also fetch immediately to get recent check-ins
    refresh()
    return () => clearInterval(interval)
  }, [refresh])

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          icon={TicketCheck}
          label="Checked in"
          value={`${stats.checkedIn} / ${stats.totalSold}`}
          trendLabel={stats.totalSold > 0 ? `${stats.checkinPct}% of sold` : "No tickets sold"}
          iconBg="bg-emerald-100"
          iconColor="text-emerald-700"
        />
        <StatCard
          icon={Users}
          label="Tickets sold"
          value={String(stats.totalSold)}
          trendLabel={stats.totalCapacity > 0 ? `of ${stats.totalCapacity} capacity` : "No capacity set"}
          iconBg="bg-blue-100"
          iconColor="text-blue-700"
        />
        <StatCard
          icon={Percent}
          label="Capacity filled"
          value={stats.totalCapacity > 0 ? `${stats.capacityPct}%` : "—"}
          trendLabel={stats.totalCapacity > 0 ? `${stats.totalSold} / ${stats.totalCapacity}` : "N/A"}
          iconBg="bg-violet-100"
          iconColor="text-violet-700"
        />
      </div>

      {/* Recent check-ins */}
      <div className="rounded-2xl border border-line bg-paper p-6 md:p-7">
        <h3 className="text-[15px] font-semibold tracking-tight text-ink mb-4">Recent check-ins</h3>
        {recent.length === 0 ? (
          <p className="text-[13px] text-ink-3">No check-ins recorded yet.</p>
        ) : (
          <div className="space-y-2">
            {recent.map((r, i) => (
              <div
                key={`${r.code}-${i}`}
                className="flex items-center justify-between rounded-lg border border-line/60 bg-paper-2/40 px-4 py-3 text-[13px]"
              >
                <div className="min-w-0">
                  <span className="font-mono text-[12px] text-ink-2 truncate block">{r.code}</span>
                  {r.holder && <span className="text-ink truncate block">{r.holder}</span>}
                </div>
                <div className="text-right shrink-0 ml-4">
                  <span className="text-ink-2 block">{r.tierName}</span>
                  <span className="text-ink-3 text-[11px] block">
                    {new Date(r.scannedAt).toLocaleTimeString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
