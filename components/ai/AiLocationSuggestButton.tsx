"use client"

import { MapPin } from "lucide-react"
import { useAiGenerate } from "./use-ai-generate"

interface LocationResult {
  country?: string
  address?: string
}

/** Same useAiGenerate pattern as the other AI tools — see AiDescriptionButton. */
export default function AiLocationSuggestButton({
  venue,
  city,
  onGenerated,
}: {
  venue: string
  city: string
  onGenerated: (result: LocationResult) => void
}) {
  const { loading, error, generate } = useAiGenerate<LocationResult>()
  const ready = !!(venue && city)

  const handleGenerate = async () => {
    if (!ready) return
    const result = await generate("/api/ai/location", { venue, city })
    if (result) onGenerated(result)
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleGenerate}
        disabled={loading || !ready}
        className="inline-flex items-center gap-1.5 text-[12px] font-medium text-blue hover:text-brand-600/80 transition-colors disabled:opacity-50"
      >
        <MapPin size={13} />
        {loading ? "Looking up location…" : "Suggest country & address from venue"}
      </button>
      {!ready && <p className="mt-1 text-[11px] text-ink-3">Fill in venue and city first.</p>}
      {error && <p className="mt-1 text-[11px] text-rose-600">{error}</p>}
    </div>
  )
}
