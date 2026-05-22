"use client"

import { useState } from "react"
import { Sparkles, Loader } from "lucide-react"

const PURPOSES = [
  { value: "reminder", label: "📅 Event reminder" },
  { value: "thank_you", label: "🙏 Thank you" },
  { value: "announcement", label: "📢 Announcement" },
  { value: "update", label: "🔄 Update" },
  { value: "custom", label: "✏️ Custom" },
] as const

interface Props {
  eventTitle: string
  eventDate: string
  onGenerated: (data: { subject: string; body: string }) => void
}

export default function AiEmailCopilot({ eventTitle, eventDate, onGenerated }: Props) {
  const [purpose, setPurpose] = useState<string>("reminder")
  const [customInstructions, setCustomInstructions] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const generate = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/ai/email-copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventTitle,
          eventDate,
          purpose,
          customInstructions: purpose === "custom" ? customInstructions : undefined,
        }),
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      onGenerated(data)
    } catch {
      setError("Could not generate email content.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-xl border border-blue-200/60 bg-blue-50/40 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Sparkles size={14} className="text-blue" />
        <span className="text-[12px] font-semibold text-blue-800">AI Email Copilot</span>
      </div>

      <div className="flex flex-wrap gap-2">
        <select
          value={purpose}
          onChange={(e) => setPurpose(e.target.value)}
          className="text-[12px] bg-paper border border-line rounded-lg px-3 py-1.5 text-ink focus:outline-none focus:ring-2 focus:ring-blue/20"
        >
          {PURPOSES.map((p) => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </select>

        <button
          onClick={generate}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-lg bg-blue text-white px-3 py-1.5 text-[12px] font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          {loading ? (
            <Loader size={12} className="animate-spin" />
          ) : (
            <Sparkles size={12} />
          )}
          {loading ? "Generating…" : "Generate"}
        </button>
      </div>

      {purpose === "custom" && (
        <textarea
          value={customInstructions}
          onChange={(e) => setCustomInstructions(e.target.value)}
          placeholder="What should the email say? (e.g. 'Remind attendees to bring ID and arrive early')"
          className="w-full text-[12px] bg-paper border border-line rounded-lg px-3 py-2 text-ink placeholder:text-ink-3 focus:outline-none focus:ring-2 focus:ring-blue/20 resize-none"
          rows={2}
        />
      )}

      {error && <p className="text-[11px] text-rose-600">{error}</p>}
    </div>
  )
}
