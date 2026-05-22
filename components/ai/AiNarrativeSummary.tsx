"use client"

import { useState } from "react"
import { BarChart3, RefreshCw } from "lucide-react"

interface Props {
  totalRevenue: number
  eventCount: number
  organizerCount: number
  topCity: string
  topCategory: string
  paymentMethods: { method: string; pct: number }[]
}

export default function AiNarrativeSummary(props: Props) {
  const [narrative, setNarrative] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const generate = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/ai/narrative", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(props),
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setNarrative(data.narrative)
    } catch {
      setNarrative("Could not generate narrative.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-2xl border border-line bg-gradient-to-br from-emerald-50/40 to-teal-50/40 p-5 tp-lift">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <BarChart3 size={15} className="text-emerald-600" />
          <h3 className="text-[14px] font-semibold tracking-tight text-ink">AI Narrative Summary</h3>
        </div>
        <button
          onClick={generate}
          disabled={loading}
          className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-emerald-700 hover:text-emerald-900 transition-colors disabled:opacity-50"
        >
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
          {narrative ? "Refresh" : "Generate"}
        </button>
      </div>

      {!narrative && !loading && (
        <p className="text-[12.5px] text-ink-2 leading-relaxed">
          Click <strong>Generate</strong> for an AI-powered narrative of your analytics.
        </p>
      )}

      {loading && (
        <div className="space-y-2 animate-pulse">
          <div className="h-4 bg-ink/10 rounded w-full" />
          <div className="h-4 bg-ink/10 rounded w-2/3" />
        </div>
      )}

      {narrative && !loading && (
        <p className="text-[12.5px] text-ink-2 leading-relaxed">{narrative}</p>
      )}
    </div>
  )
}
