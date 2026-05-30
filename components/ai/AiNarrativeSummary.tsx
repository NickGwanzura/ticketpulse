"use client"

import { BarChart3, RefreshCw } from "lucide-react"
import { useAiGenerate } from "./use-ai-generate"

interface Props {
  totalRevenue: number
  eventCount: number
  organizerCount: number
  topCity: string
  topCategory: string
  paymentMethods: { method: string; pct: number }[]
}

export default function AiNarrativeSummary(props: Props) {
  const { data: result, loading, error, generate } = useAiGenerate<{ narrative: string }>()

  const handleGenerate = () => {
    generate("/api/ai/narrative", props)
  }

  return (
    <div className="rounded-2xl border border-line bg-gradient-to-br from-green-50/40 to-teal-50/40 p-5 tp-lift">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <BarChart3 size={15} className="text-brand-600" />
          <h3 className="text-[14px] font-semibold tracking-tight text-ink">AI Narrative Summary</h3>
        </div>
        <button
          onClick={handleGenerate}
          disabled={loading}
          className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-green-700 hover:text-green-900 transition-colors disabled:opacity-50"
        >
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
          {result ? "Refresh" : "Generate"}
        </button>
      </div>

      {error && <p className="text-[12px] text-rose-600 mb-2">{error}</p>}

      {!result && !loading && (
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

      {result && !loading && (
        <p className="text-[12.5px] text-ink-2 leading-relaxed">{result.narrative}</p>
      )}
    </div>
  )
}
