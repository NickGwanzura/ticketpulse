"use client"

import { Sparkles } from "lucide-react"
import { useAiGenerate } from "./use-ai-generate"

interface PricingSuggestion {
  reasoning: string
  suggestedRange: string
}

export default function AiPricingButton({
  eventTitle,
  category,
  venue,
  city,
}: {
  eventTitle: string
  category: string
  venue: string
  city: string
}) {
  const { data: result, loading, error, generate } = useAiGenerate<PricingSuggestion>()

  const handleGenerate = () => {
    generate("/api/ai/pricing", { eventTitle, category, venue, city })
  }

  return (
    <div>
      <button
        onClick={handleGenerate}
        disabled={loading}
        className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-ink-2 hover:text-navy transition-colors disabled:opacity-50"
      >
        <Sparkles size={12} />
        {loading ? "Thinking…" : result ? "Refresh pricing" : "AI pricing suggestion"}
      </button>

      {error && <p className="text-[11px] text-rose-600 mt-1">{error}</p>}

      {result && !loading && (
        <div className="mt-2 rounded-lg border border-line bg-paper p-3">
          <p className="text-[18px] font-bold tracking-tight text-ink">{result.suggestedRange}</p>
          <p className="text-[11px] text-ink-3 mt-1">{result.reasoning}</p>
        </div>
      )}
    </div>
  )
}
