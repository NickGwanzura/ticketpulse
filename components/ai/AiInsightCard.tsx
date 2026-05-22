"use client"

import { useState } from "react"
import { Lightbulb, RefreshCw } from "lucide-react"

export default function AiInsightCard({
  eventTitle,
  sold,
  capacity,
  daysRemaining,
  category,
  city,
}: {
  eventTitle: string
  sold: number
  capacity: number
  daysRemaining: number
  category: string
  city: string
}) {
  const [insight, setInsight] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const generate = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/ai/insight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventTitle, sold, capacity, daysRemaining, category, city }),
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setInsight(data.insight)
    } catch {
      setInsight("Could not generate insight right now.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-xl border border-amber-200/60 bg-amber-50/40 p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Lightbulb size={14} className="text-amber-600" />
          <span className="text-[12px] font-semibold text-amber-800">AI Sales Insight</span>
        </div>
        <button
          onClick={generate}
          disabled={loading}
          className="text-[11px] font-medium text-amber-700 hover:text-amber-900 transition-colors disabled:opacity-50 inline-flex items-center gap-1"
        >
          <RefreshCw size={11} className={loading ? "animate-spin" : ""} />
          {insight ? "Refresh" : "Generate"}
        </button>
      </div>

      {!insight && !loading && (
        <p className="text-[12px] text-amber-700/70">Click Generate for an AI-powered sales tip.</p>
      )}

      {loading && (
        <div className="h-4 bg-amber-200/40 rounded animate-pulse w-3/4" />
      )}

      {insight && !loading && (
        <p className="text-[12.5px] text-amber-900 leading-relaxed">{insight}</p>
      )}
    </div>
  )
}
