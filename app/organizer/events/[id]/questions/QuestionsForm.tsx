"use client"

import { useState, useTransition } from "react"
import { HelpCircle, Plus, Trash2, GripVertical, Loader2 } from "lucide-react"
import { saveEventQuestions } from "./actions"

type Question = {
  id?: string
  question: string
  required: boolean
  scope: "order" | "attendee"
  sortOrder: number
}

export default function QuestionsForm({
  eventId,
  initialQuestions,
}: {
  eventId: string
  initialQuestions: Question[]
}) {
  const [questions, setQuestions] = useState<Question[]>(
    initialQuestions.length > 0
      ? initialQuestions.sort((a, b) => a.sortOrder - b.sortOrder)
      : []
  )
  const [saving, startSave] = useTransition()
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canAdd = questions.length < 4

  const addQuestion = () => {
    if (!canAdd) return
    setQuestions((prev) => [
      ...prev,
      { question: "", required: false, scope: "order", sortOrder: prev.length },
    ])
    setSaved(false)
  }

  const updateQuestion = (index: number, patch: Partial<Question>) => {
    setQuestions((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], ...patch }
      return next
    })
    setSaved(false)
  }

  const removeQuestion = (index: number) => {
    setQuestions((prev) => {
      const next = prev.filter((_, i) => i !== index)
      return next.map((q, i) => ({ ...q, sortOrder: i }))
    })
    setSaved(false)
  }

  const handleSubmit = () => {
    setError(null)
    const valid = questions.filter((q) => q.question.trim().length > 0)
    if (valid.length === 0 && questions.length > 0) {
      setError("Please fill in all question fields or remove empty ones.")
      return
    }
    startSave(async () => {
      try {
        await saveEventQuestions(
          eventId,
          valid.map((q, i) => ({ ...q, sortOrder: i }))
        )
        setSaved(true)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save")
      }
    })
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-line bg-paper p-6 md:p-7">
        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.18em] text-blue uppercase mb-1">Ticket questions</p>
            <h2 className="text-[18px] font-semibold tracking-tight text-ink">Pre-sale questions</h2>
            <p className="text-xs text-ink-3 mt-1">Ask attendees up to 4 questions before they buy a ticket.</p>
          </div>
          <span className="text-[12px] font-medium text-ink-3">
            {questions.length}/4
          </span>
        </div>

        {questions.length === 0 ? (
          <div className="text-center py-10 rounded-xl border border-dashed border-line bg-paper-2">
            <HelpCircle size={28} className="mx-auto text-ink-3 mb-3" />
            <p className="text-[13px] font-medium text-ink-2">No questions yet</p>
            <p className="text-[12px] text-ink-3 mt-1">Add questions to learn more about your attendees.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {questions.map((q, index) => (
              <div
                key={q.id ?? `new-${index}`}
                className="flex items-start gap-3 rounded-xl border border-line bg-paper p-4"
              >
                <GripVertical size={16} className="text-ink-3 mt-2.5 shrink-0" />
                <div className="flex-1 min-w-0 space-y-3">
                  <div>
                    <label className="block text-[12px] font-medium text-ink-2 mb-1.5">
                      Question {index + 1}
                    </label>
                    <input
                      type="text"
                      value={q.question}
                      onChange={(e) => updateQuestion(index, { question: e.target.value })}
                      placeholder="e.g. Dietary requirements?"
                      maxLength={500}
                      className="w-full bg-paper border border-line rounded-xl px-4 py-2.5 text-[14px] text-ink placeholder:text-ink-3 focus:outline-none focus:border-green-500 focus:ring-4 focus:ring-brand-500/10 transition"
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-4">
                    <label className="inline-flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={q.required}
                        onChange={(e) => updateQuestion(index, { required: e.target.checked })}
                        className="rounded border-line text-brand-600 focus:ring-brand-500"
                      />
                      <span className="text-[13px] text-ink-2">Required</span>
                    </label>
                    <div className="flex items-center gap-1.5 rounded-lg border border-line bg-paper-2 p-0.5">
                      <button
                        type="button"
                        onClick={() => updateQuestion(index, { scope: "order" })}
                        className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition-all ${q.scope === "order" ? "bg-paper text-ink shadow-sm" : "text-ink-3 hover:text-ink-2"}`}
                      >
                        Per order
                      </button>
                      <button
                        type="button"
                        onClick={() => updateQuestion(index, { scope: "attendee" })}
                        className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition-all ${q.scope === "attendee" ? "bg-paper text-ink shadow-sm" : "text-ink-3 hover:text-ink-2"}`}
                      >
                        Per attendee
                      </button>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => removeQuestion(index)}
                  className="shrink-0 inline-flex items-center justify-center h-8 w-8 rounded-lg border border-line text-ink-3 hover:text-red-500 hover:border-red-200 transition"
                  aria-label="Remove question"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}

        {canAdd && (
          <button
            type="button"
            onClick={addQuestion}
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-line px-4 py-2 text-[13px] font-medium text-ink-2 hover:text-ink hover:bg-paper-2 transition"
          >
            <Plus size={14} /> Add question
          </button>
        )}

        {error && (
          <p className="mt-4 text-[13px] text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        {saved && (
          <p className="mt-4 text-[13px] text-green-700 bg-green-50 border border-green-100 rounded-lg px-3 py-2">
            Questions saved successfully.
          </p>
        )}

        <div className="mt-6 flex items-center gap-3">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-5 py-2.5 text-[14px] font-semibold text-white shadow-sm shadow-brand-600/20 hover:bg-brand-700 active:scale-[0.99] transition disabled:opacity-80"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : null}
            Save questions
          </button>
        </div>
      </div>
    </div>
  )
}
