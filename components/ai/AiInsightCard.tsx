"use client"

import { Lightbulb, RefreshCw } from "lucide-react"
import { useAiGenerate } from "./use-ai-generate"

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
  const { data: result, loading, error, generate } = useAiGenerate<{ insight: string }>()

  const handleGenerate = () => {
    generate("/api/ai/insight", { eventTitle, sold, capacity, daysRemaining, category, city })
  }

  return (
    <div className="rounded-xl border border-amber-200/60 bg-amber-50/40 p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Lightbulb size={14} className="text-amber-600" />
          <span className="text-[12px] font-semibold text-amber-800">AI Sales Insight</span>
        </div>
        <button
          onClick={handleGenerate}
          disabled={loading}
          className="text-[11px] font-medium text-amber-700 hover:text-amber-900 transition-colors disabled:opacity-50 inline-flex items-center gap-1"
        >
          <RefreshCw size={11} className={loading ? "animate-spin" : ""} />
          {result ? "Refresh" : "Generate"}
        </button>
      </div>

      {error && <p className="text-[11px] text-rose-600 mb-1">{error}</p>}

      {!result && !loading && (
        <p className="text-[12px] text-amber-700/70">Click Generate for an AI-powered sales tip.</p>
      )}

      {loading && (
        <div className="h-4 bg-amber-200/40 rounded animate-pulse w-3/4" />
      )}

      {result && !loading && (
        <p className="text-[13px] text-amber-900 leading-relaxed">{result.insight}</p>
      )}
    </div>
  )
}
