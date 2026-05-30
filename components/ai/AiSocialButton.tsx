"use client"

import { useState } from "react"
import { Sparkles, Copy, Check, Loader } from "lucide-react"

const PLATFORMS = [
  { value: "twitter", label: "Twitter/X" },
  { value: "facebook", label: "Facebook" },
  { value: "instagram", label: "Instagram" },
] as const

export default function AiSocialButton({
  eventTitle,
  category,
  eventDate,
  venue,
  city,
}: {
  eventTitle: string
  category: string
  eventDate: string
  venue: string
  city: string
}) {
  const [blurb, setBlurb] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [platform, setPlatform] = useState<"twitter" | "facebook" | "instagram">("twitter")
  const [copied, setCopied] = useState(false)

  const generate = async () => {
    setLoading(true)
    setBlurb(null)
    try {
      const res = await fetch("/api/ai/social", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventTitle, category, eventDate, venue, city, platform }),
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setBlurb(data.blurb)
    } catch {
      setBlurb("Could not generate a post right now.")
    } finally {
      setLoading(false)
    }
  }

  const copy = async () => {
    if (blurb) {
      await navigator.clipboard.writeText(blurb)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-2 flex-wrap">
        <select
          value={platform}
          onChange={(e) => setPlatform(e.target.value as typeof platform)}
          className="text-[11px] bg-paper border border-line rounded-lg px-2 py-1.5 text-ink-2 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
        >
          {PLATFORMS.map((p) => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </select>
        <button
          onClick={generate}
          disabled={loading}
          className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-blue hover:text-green-700 transition-colors disabled:opacity-50"
        >
          {loading ? (
            <Loader size={12} className="animate-spin" />
          ) : (
            <Sparkles size={12} />
          )}
          {loading ? "Generating…" : blurb ? "Re-generate" : "Generate post"}
        </button>
      </div>

      {blurb && !loading && (
        <div className="relative rounded-lg border border-line bg-paper p-3">
          <p className="text-[12px] text-ink-2 leading-relaxed pr-8">{blurb}</p>
          <button
            onClick={copy}
            className="absolute top-2 right-2 text-ink-3 hover:text-ink transition-colors"
            title="Copy to clipboard"
          >
            {copied ? <Check size={14} className="text-brand-600" /> : <Copy size={14} />}
          </button>
        </div>
      )}
    </div>
  )
}
