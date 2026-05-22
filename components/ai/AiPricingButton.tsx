"use client"

import { useState } from "react"
import { Sparkles, RefreshCw } from "lucide-react"

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
  const [result, setResult] = useState<PricingSuggestion | null>(null)
  const [loading, setLoading] = useState(false)

  const generate = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/ai/pricing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventTitle, category, venue, city }),
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setResult(data)
    } catch {
      setResult(null)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <button
        onClick={generate}
        disabled={loading}
        className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-ink-2 hover:text-navy transition-colors disabled:opacity-50"
      >
        <Sparkles size={12} />
        {loading ? "Thinking…" : result ? "Refresh pricing" : "AI pricing suggestion"}
      </button>

      {result && !loading && (
        <div className="mt-2 rounded-lg border border-line bg-paper p-3">
          <p className="text-[18px] font-bold tracking-tight text-ink">{result.suggestedRange}</p>
          <p className="text-[11px] text-ink-3 mt-1">{result.reasoning}</p>
        </div>
      )}
    </div>
  )
}
