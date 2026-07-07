"use client"

import { useState, useTransition } from "react"
import { updateSeoAction } from "../actions"
import { inputBaseClass } from "@/lib/utils"

interface Props {
  eventId: string
  eventTitle: string
  eventSlug: string
  metaTitle?: string | null
  metaDescription?: string | null
}

const MAX_TITLE = 60
const MAX_DESC = 160

export default function SeoForm({
  eventId,
  eventTitle,
  eventSlug,
  metaTitle,
  metaDescription,
}: Props) {
  const [title, setTitle] = useState(metaTitle ?? "")
  const [description, setDescription] = useState(metaDescription ?? "")
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle")
  const [errorMsg, setErrorMsg] = useState("")
  const [isPending, startTransition] = useTransition()

  const previewTitle = title.trim() || eventTitle
  const previewDesc = description.trim() || "Discover this event on TicketPulse."
  const previewUrl = `ticketpulse.tech/events/${eventSlug}`

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      setStatus("idle")
      setErrorMsg("")
      const result = await updateSeoAction(eventId, fd)
      if ("success" in result) {
        setStatus("success")
        setTimeout(() => setStatus("idle"), 3000)
      } else {
        setStatus("error")
        setErrorMsg(result.error)
      }
    })
  }

  return (
    <div className="space-y-6">
      {/* Form */}
      <form onSubmit={handleSubmit} className="rounded-xl border border-line bg-paper p-5 sm:p-6 space-y-5">
        {/* Meta Title */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label htmlFor="metaTitle" className="block text-[13px] font-medium text-ink">
              Meta Title
            </label>
            <span className={`text-[11px] font-medium tabular-nums ${title.length > MAX_TITLE ? "text-rose-500" : "text-ink-3"}`}>
              {title.length} / {MAX_TITLE}
            </span>
          </div>
          <input
            id="metaTitle"
            name="metaTitle"
            type="text"
            maxLength={MAX_TITLE}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={eventTitle}
            className={inputBaseClass}
          />
          <p className="mt-1 text-[11px] text-ink-3">
            Shown as the clickable headline in search results. {MAX_TITLE} chars max.
          </p>
        </div>

        {/* Meta Description */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label htmlFor="metaDescription" className="block text-[13px] font-medium text-ink">
              Meta Description
            </label>
            <span className={`text-[11px] font-medium tabular-nums ${description.length > MAX_DESC ? "text-rose-500" : "text-ink-3"}`}>
              {description.length} / {MAX_DESC}
            </span>
          </div>
          <textarea
            id="metaDescription"
            name="metaDescription"
            rows={3}
            maxLength={MAX_DESC}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe your event for search engines"
            className={`${inputBaseClass} resize-none`}
          />
          <p className="mt-1 text-[11px] text-ink-3">
            Shown below the title in search results. {MAX_DESC} chars max.
          </p>
        </div>

        {/* Status feedback */}
        {status === "success" && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[13px] text-emerald-800">
            SEO settings saved successfully.
          </div>
        )}
        {status === "error" && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] text-rose-700">
            {errorMsg}
          </div>
        )}

        <button
          type="submit"
          disabled={isPending || title.length > MAX_TITLE || description.length > MAX_DESC}
          className="inline-flex items-center rounded-xl bg-ink px-5 py-2.5 text-[13px] font-semibold text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {isPending ? "Saving…" : "Save SEO settings"}
        </button>
      </form>

      {/* Google preview card */}
      <div className="rounded-xl border border-line bg-paper p-5 sm:p-6">
        <p className="text-[11px] font-semibold tracking-widest uppercase text-ink-3 mb-4">
          Google Preview
        </p>
        <div className="rounded-xl border border-line bg-paper-2 px-4 py-4 max-w-[600px]">
          {/* Favicon + site chip */}
          <div className="flex items-center gap-2 mb-1">
            <div className="h-4 w-4 rounded-full bg-paper-2 border border-line flex items-center justify-center overflow-hidden shrink-0">
              <span className="text-[8px] font-bold text-ink-3">T</span>
            </div>
            <span className="text-[12px] text-ink-2 leading-none">TicketPulse</span>
            <span className="text-[12px] text-ink-3 leading-none">›</span>
          </div>

          {/* Title */}
          <p className="text-[18px] font-normal leading-snug text-blue-600 hover:underline cursor-default truncate">
            {previewTitle.length > MAX_TITLE ? previewTitle.slice(0, MAX_TITLE) + "…" : previewTitle}
          </p>

          {/* URL */}
          <p className="text-[12px] text-emerald-700 mt-0.5 truncate">{previewUrl}</p>

          {/* Description */}
          <p className="text-[13px] text-ink-3 mt-1 leading-relaxed line-clamp-2">
            {previewDesc.length > MAX_DESC ? previewDesc.slice(0, MAX_DESC) + "…" : previewDesc}
          </p>
        </div>
        <p className="mt-3 text-[11px] text-ink-3">
          This preview updates as you type. Actual appearance may vary by search engine.
        </p>
      </div>
    </div>
  )
}
