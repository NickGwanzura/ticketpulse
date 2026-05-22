"use client"

import { useState } from "react"
import { Sparkles, X, Loader } from "lucide-react"

interface Props {
  title: string
  description: string
  category: string
  existingTags: string[]
  onTagsChange: (tags: string[]) => void
}

export default function AiTagSuggest({ title, description, category, existingTags, onTagsChange }: Props) {
  const [suggested, setSuggested] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const generate = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/ai/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description, category }),
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setSuggested(data.tags ?? [])
    } catch {
      setError("Could not generate tags.")
    } finally {
      setLoading(false)
    }
  }

  const addTag = (tag: string) => {
    if (!existingTags.includes(tag)) {
      onTagsChange([...existingTags, tag])
    }
    setSuggested((prev) => prev.filter((t) => t !== tag))
  }

  const removeTag = (tag: string) => {
    onTagsChange(existingTags.filter((t) => t !== tag))
  }

  const allSuggestedUsed = suggested.length > 0 && suggested.every((t) => existingTags.includes(t))

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={generate}
          disabled={loading}
          className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-ink-2 hover:text-navy transition-colors disabled:opacity-50"
        >
          {loading ? (
            <Loader size={12} className="animate-spin" />
          ) : (
            <Sparkles size={12} />
          )}
          {loading ? "Generating…" : suggested.length > 0 ? "Re-suggest tags" : "Suggest tags"}
        </button>
        {error && <span className="text-[11px] text-rose-600">{error}</span>}
      </div>

      {/* Existing tags */}
      {existingTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {existingTags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 rounded-full bg-paper-2 px-2.5 py-1 text-[11px] font-medium text-ink-2 ring-1 ring-line"
            >
              {tag}
              <button type="button" onClick={() => removeTag(tag)} className="hover:text-ink transition-colors">
                <X size={10} />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Suggested tags */}
      {suggested.length > 0 && !allSuggestedUsed && (
        <div className="flex flex-wrap gap-1.5">
          <span className="text-[10.5px] text-ink-3 self-center">Suggestions:</span>
          {suggested.map((tag) => {
            const alreadyAdded = existingTags.includes(tag)
            return (
              <button
                key={tag}
                type="button"
                disabled={alreadyAdded}
                onClick={() => addTag(tag)}
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
                  alreadyAdded
                    ? "bg-green-50 text-green-600 cursor-default"
                    : "bg-green-50 text-blue hover:bg-green-100"
                }`}
              >
                + {tag}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
