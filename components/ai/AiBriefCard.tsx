"use client"

import { useState } from "react"
import { Sparkles, RefreshCw } from "lucide-react"

interface Brief {
  summary: string
  highlights: string[]
}

export default function AiBriefCard({
  activeEvents,
  totalOrganizers,
  totalRevenue,
  topCategory,
  topCity,
}: {
  activeEvents: number
  totalOrganizers: number
  totalRevenue: number
  topCategory: string
  topCity: string
}) {
  const [brief, setBrief] = useState<Brief | null>(null)
  const [loading, setLoading] = useState(false)

  const generate = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/ai/brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activeEvents, totalOrganizers, totalRevenue, topCategory, topCity }),
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setBrief(data)
    } catch {
      setBrief(null)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-2xl border border-line bg-gradient-to-br from-blue-50/40 to-indigo-50/40 p-5 tp-lift">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sparkles size={15} className="text-green-600" />
          <h3 className="text-[14px] font-semibold tracking-tight text-ink">AI Platform Brief</h3>
        </div>
        <button
          onClick={generate}
          disabled={loading}
          className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-blue hover:text-green-700 transition-colors disabled:opacity-50"
        >
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
          {brief ? "Refresh" : "Generate"}
        </button>
      </div>

      {!brief && !loading && (
        <p className="text-[12.5px] text-ink-2 leading-relaxed">
          Click <strong>Generate</strong> for an AI-powered summary of platform health.
        </p>
      )}

      {loading && (
        <div className="space-y-2 animate-pulse">
          <div className="h-4 bg-ink/10 rounded w-full" />
          <div className="h-4 bg-ink/10 rounded w-3/4" />
          <div className="h-3 bg-ink/10 rounded w-1/2 mt-3" />
        </div>
      )}

      {brief && !loading && (
        <>
          <p className="text-[12.5px] text-ink-2 leading-relaxed">{brief.summary}</p>
          {brief.highlights.length > 0 && (
            <ul className="mt-3 space-y-1">
              {brief.highlights.map((h, i) => (
                <li key={i} className="text-[11.5px] text-ink-2 flex items-start gap-2">
                  <span className="text-blue mt-0.5 shrink-0">✦</span>
                  {h}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  )
}
