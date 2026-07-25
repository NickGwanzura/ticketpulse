"use client"

import { Sparkles } from "lucide-react"
import { useAiGenerate } from "./use-ai-generate"

interface DescriptionResult {
  description: string
}

/**
 * Same shape as AiPricingButton/AiSocialButton/etc (Sparkles + useAiGenerate)
 * — before this, event-description generation was a bespoke fetch+state
 * block inline in NewEventForm, the only one of the AI tools that didn't
 * follow the pattern the other 7 AI components already share.
 */
export default function AiDescriptionButton({
  title,
  category,
  venue,
  city,
  tags,
  onGenerated,
}: {
  title: string
  category: string
  venue: string
  city: string
  tags?: string
  onGenerated: (description: string) => void
}) {
  const { loading, error, generate } = useAiGenerate<DescriptionResult>()
  const ready = !!(title && category && venue && city)

  const handleGenerate = async () => {
    if (!ready) return
    const result = await generate("/api/ai/description", { title, category, venue, city, tags })
    if (result?.description) onGenerated(result.description)
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleGenerate}
        disabled={loading || !ready}
        className="inline-flex items-center gap-1 text-[12px] font-medium text-blue hover:text-brand-600/80 transition-colors disabled:opacity-50"
      >
        <Sparkles size={12} />
        {loading ? "Generating…" : "Generate with AI"}
      </button>
      {!ready && <p className="mt-1 text-[11px] text-ink-3">Fill in title, category, venue, and city first.</p>}
      {error && <p className="mt-1 text-[11px] text-rose-600">{error}</p>}
    </div>
  )
}
