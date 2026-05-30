"use client"

import { useState } from "react"
import { ShieldAlert, ShieldCheck, Loader } from "lucide-react"

export default function AiModerateButton({
  title,
  description,
  category,
}: {
  title: string
  description: string
  category: string
}) {
  const [result, setResult] = useState<{ flagged: boolean; reason: string | null } | null>(null)
  const [loading, setLoading] = useState(false)

  const check = async () => {
    setLoading(true)
    setResult(null)
    try {
      const res = await fetch("/api/ai/moderate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description, category }),
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setResult(data)
    } catch {
      setResult({ flagged: false, reason: "Could not reach AI moderation service." })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <button
        onClick={check}
        disabled={loading}
        className="inline-flex items-center gap-1.5 text-[11px] font-medium text-ink-2 hover:text-navy transition-colors disabled:opacity-50"
        title="AI content check"
      >
        {loading ? (
          <Loader size={12} className="animate-spin" />
        ) : (
          <ShieldAlert size={12} />
        )}
        {loading ? "Scanning…" : result ? "Re-scan" : "AI check"}
      </button>

      {result && !loading && (
        <div className={`mt-2 text-[11px] flex items-start gap-1.5 ${result.flagged ? "text-rose-600" : "text-brand-600"}`}>
          {result.flagged ? (
            <>
              <ShieldAlert size={12} className="mt-0.5 shrink-0" />
              <span>{result.reason ?? "Flagged for review."}</span>
            </>
          ) : (
            <>
              <ShieldCheck size={12} className="mt-0.5 shrink-0" />
              <span>Looks good</span>
            </>
          )}
        </div>
      )}
    </div>
  )
}
