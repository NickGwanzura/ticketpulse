"use client"

import { useEffect, useState, useCallback } from "react"
import { Users, TicketCheck, Percent, ScanLine, Pause, Play, RefreshCw } from "lucide-react"
import StatCard from "@/components/dashboard/StatCard"
import EmptyState from "@/components/dashboard/EmptyState"

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

const POLL_INTERVAL_MS = 30_000 // 30 seconds (was 5s — causing refresh complaints)

export default function LiveDashboardClient({
  eventId,
  initialStats,
}: {
  eventId: string
  initialStats: LiveStats
}) {
  const [stats, setStats] = useState<LiveStats>(initialStats)
  const [recent, setRecent] = useState<RecentCheckin[]>([])
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [fetchError, setFetchError] = useState(false)
  const [paused, setPaused] = useState(false)
  const [isFetching, setIsFetching] = useState(false)

  const refresh = useCallback(async (isManual = false) => {
    if (isFetching && !isManual) return
    setIsFetching(true)
    try {
      const res = await fetch(`/api/events/${eventId}/live/stats`)
      if (res.ok) {
        const data = await res.json()
        setStats(data.stats)
        setRecent(data.recent ?? [])
        setLastUpdated(new Date())
        setFetchError(false)
      } else {
        setFetchError(true)
      }
    } catch {
      setFetchError(true)
    } finally {
      setIsFetching(false)
    }
  }, [eventId, isFetching])

  // Auto-refresh only when not paused
  useEffect(() => {
    if (paused) return
    const interval = setInterval(refresh, POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [refresh, paused])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between text-[12px]">
        <div className="flex items-center gap-3">
          <span className="text-ink-3">
            {paused ? "Auto-refresh paused" : "Updates every 30 seconds"}
          </span>
          <button
            onClick={() => setPaused((v) => !v)}
            className="inline-flex items-center gap-1 rounded-lg border border-line px-2.5 py-1.5 text-[11px] font-medium text-ink-2 hover:bg-paper-2 transition-colors"
            title={paused ? "Resume auto-refresh" : "Pause auto-refresh"}
          >
            {paused ? <Play size={12} /> : <Pause size={12} />}
            {paused ? "Resume" : "Pause"}
          </button>
          <button
            onClick={() => refresh(true)}
            disabled={isFetching}
            className="inline-flex items-center gap-1 rounded-lg border border-line px-2.5 py-1.5 text-[11px] font-medium text-ink-2 hover:bg-paper-2 transition-colors disabled:opacity-50"
            title="Refresh now"
          >
            <RefreshCw size={12} className={isFetching ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
        {fetchError ? (
          <span className="text-rose-600 font-medium">Live data unavailable — retrying…</span>
        ) : lastUpdated ? (
          <span className="text-ink-3">Last updated {lastUpdated.toLocaleTimeString()}</span>
        ) : null}
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          icon={TicketCheck}
          label="Checked in"
          value={`${stats.checkedIn} / ${stats.totalSold}`}
          trendLabel={stats.totalSold > 0 ? `${stats.checkinPct}% of sold` : "No tickets sold"}
          iconBg="bg-green-100"
          iconColor="text-green-700"
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
          <EmptyState
            icon={ScanLine}
            title="No check-ins yet"
            body="Scanned tickets will appear here in real time."
          />
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
