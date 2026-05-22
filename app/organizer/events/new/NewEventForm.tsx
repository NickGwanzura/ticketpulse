"use client"

import { useActionState, useState } from "react"
import { useFormStatus } from "react-dom"
import Link from "next/link"
import { ArrowLeft, ImageIcon, Save, Sparkles, Loader2, MapPin } from "lucide-react"

import Button from "@/components/ui/Button"
import { createEventAction, type CreateEventState } from "./actions"
import AiModerateButton from "@/components/ai/AiModerateButton"
import AiTagSuggest from "@/components/ai/AiTagSuggest"
import AiSocialButton from "@/components/ai/AiSocialButton"
import AiPricingButton from "@/components/ai/AiPricingButton"

const INITIAL: CreateEventState = { ok: true }

const CATEGORIES = [
  "Concert",
  "Festival",
  "Marathon",
  "Walkathon",
  "Film",
  "Exhibition",
  "Expedition",
  "Conference",
  "Sport",
  "Theatre",
  "Comedy",
  "Other",
]

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return <p className="mt-1 text-[12px] text-rose-600">{message}</p>
}

function inputCls(hasError?: boolean) {
  return [
    "w-full rounded-xl border bg-paper px-3 py-2.5 text-[14px] text-ink",
    "placeholder:text-ink-3 focus:outline-none focus:ring-4",
    hasError
      ? "border-rose-300 focus:border-rose-400 focus:ring-rose-500/15"
      : "border-line focus:border-line-2 focus:ring-green-500/15",
  ].join(" ")
}

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" loading={pending} size="md">
      <Save size={14} /> {pending ? "Creating…" : "Create event"}
    </Button>
  )
}

export default function NewEventForm() {
  const [state, formAction] = useActionState(createEventAction, INITIAL)
  const errs = state.fieldErrors ?? {}

  const [genDesc, setGenDesc] = useState(false)
  const [genLoc, setGenLoc] = useState(false)
  const [tags, setTags] = useState<string[]>([])

  async function handleGenerateDesc(form: HTMLFormElement) {
    const fd = new FormData(form)
    const title = fd.get("title")?.toString() ?? ""
    const category = fd.get("category")?.toString() ?? ""
    const venue = fd.get("venue")?.toString() ?? ""
    const city = fd.get("city")?.toString() ?? ""
    const tags = fd.get("tags")?.toString()

    if (!title || !category || !venue || !city) {
      alert("Fill in title, category, venue, and city first.")
      return
    }

    setGenDesc(true)
    try {
      const res = await fetch("/api/ai/description", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, category, venue, city, tags }),
      })
      const data = await res.json()
      if (data.description) {
        const el = document.getElementById("description") as HTMLTextAreaElement | null
        if (el) el.value = data.description
      }
    } catch {
      // silently fail
    } finally {
      setGenDesc(false)
    }
  }

  async function handleSuggestLocation(form: HTMLFormElement) {
    const fd = new FormData(form)
    const venue = fd.get("venue")?.toString() ?? ""
    const city = fd.get("city")?.toString() ?? ""

    if (!venue || !city) {
      alert("Fill in venue and city first.")
      return
    }

    setGenLoc(true)
    try {
      const res = await fetch("/api/ai/location", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ venue, city }),
      })
      const data = await res.json()
      if (data.country) {
        const el = document.getElementById("country") as HTMLInputElement | null
        if (el) el.value = data.country
      }
      if (data.address) {
        const el = document.getElementById("address") as HTMLInputElement | null
        if (el) el.value = data.address
      }
    } catch {
      // silently fail
    } finally {
      setGenLoc(false)
    }
  }

  return (
    <form id="new-event-form" action={formAction} className="space-y-6">
      {state.error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] text-rose-700">
          {state.error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="md:col-span-2">
          <label htmlFor="title" className="block text-[13px] font-medium text-ink mb-1.5">Title</label>
          <input
            id="title"
            name="title"
            type="text"
            required
            maxLength={160}
            placeholder="Summer Sounds 2026"
            className={inputCls(!!errs.title)}
          />
          <FieldError message={errs.title} />
        </div>

        <div>
          <label htmlFor="category" className="block text-[13px] font-medium text-ink mb-1.5">Category</label>
          <select
            id="category"
            name="category"
            required
            defaultValue=""
            className={inputCls(!!errs.category)}
          >
            <option value="" disabled>Pick a category</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <FieldError message={errs.category} />
        </div>

        <div>
          <label htmlFor="tags" className="block text-[13px] font-medium text-ink mb-1.5">Tags</label>
          <input id="tags" name="tags" type="hidden" value={tags.join(", ")} />
          <AiTagSuggest
            title=""
            description=""
            category=""
            existingTags={tags}
            onTagsChange={setTags}
          />
          <p className="mt-1 text-[11.5px] text-ink-3">Up to 10. AI-suggested tags appear below.</p>
        </div>

        <div className="md:col-span-2">
          <div className="flex items-center justify-between mb-1.5">
            <label htmlFor="description" className="block text-[13px] font-medium text-ink">Description</label>
            <div className="flex items-center gap-3">
              <AiModerateButton title="" description="" category="" />
              <button
                type="button"
                onClick={() => {
                  const form = document.getElementById("new-event-form") as HTMLFormElement | null
                  if (form) handleGenerateDesc(form)
                }}
                disabled={genDesc}
                className="inline-flex items-center gap-1 text-[11.5px] font-medium text-blue hover:text-green-600/80 transition-colors disabled:opacity-50"
              >
                {genDesc ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <Sparkles size={12} />
                )}
                {genDesc ? "Generating…" : "Generate with AI"}
              </button>
            </div>
          </div>
          <textarea
            id="description"
            name="description"
            rows={4}
            maxLength={4000}
            placeholder="What should attendees expect?"
            className={inputCls()}
          />
        </div>

        <div>
          <label htmlFor="venue" className="block text-[13px] font-medium text-ink mb-1.5">Venue</label>
          <input
            id="venue"
            name="venue"
            type="text"
            required
            maxLength={160}
            placeholder="HICC"
            className={inputCls(!!errs.venue)}
          />
          <FieldError message={errs.venue} />
        </div>

        <div>
          <label htmlFor="city" className="block text-[13px] font-medium text-ink mb-1.5">City</label>
          <input
            id="city"
            name="city"
            type="text"
            required
            maxLength={80}
            placeholder="Harare"
            className={inputCls(!!errs.city)}
          />
          <FieldError message={errs.city} />
        </div>

        <div>
          <label htmlFor="country" className="block text-[13px] font-medium text-ink mb-1.5">Country</label>
          <input
            id="country"
            name="country"
            type="text"
            defaultValue="Zimbabwe"
            maxLength={80}
            className={inputCls(!!errs.country)}
          />
          <FieldError message={errs.country} />
        </div>

        <div>
          <label htmlFor="address" className="block text-[13px] font-medium text-ink mb-1.5">Address</label>
          <input
            id="address"
            name="address"
            type="text"
            maxLength={240}
            placeholder="Street, suburb"
            className={inputCls()}
          />
        </div>

        <div className="md:col-span-2">
          <button
            type="button"
            onClick={() => {
              const form = document.getElementById("new-event-form") as HTMLFormElement | null
              if (form) handleSuggestLocation(form)
            }}
            disabled={genLoc}
            className="inline-flex items-center gap-1.5 text-[12px] font-medium text-blue hover:text-green-600/80 transition-colors disabled:opacity-50"
          >
            {genLoc ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <MapPin size={13} />
            )}
            {genLoc ? "Looking up location…" : "Suggest country & address from venue"}
          </button>
        </div>

        <div className="md:col-span-2">
          <label htmlFor="googleMapsUrl" className="block text-[13px] font-medium text-ink mb-1.5">Google Maps link <span className="text-ink-3 font-normal">(optional)</span></label>
          <input
            id="googleMapsUrl"
            name="googleMapsUrl"
            type="url"
            placeholder="https://maps.google.com/?q=..."
            className={inputCls()}
          />
          <p className="mt-1 text-[11.5px] text-ink-3">Paste a Google Maps URL for this venue. If not provided, one will be auto-generated from coordinates.</p>
        </div>

        <div>
          <label htmlFor="startsAt" className="block text-[13px] font-medium text-ink mb-1.5">Starts at</label>
          <input
            id="startsAt"
            name="startsAt"
            type="datetime-local"
            required
            className={inputCls(!!errs.startsAt)}
          />
          <FieldError message={errs.startsAt} />
        </div>

        <div>
          <label htmlFor="endsAt" className="block text-[13px] font-medium text-ink mb-1.5">Ends at</label>
          <input
            id="endsAt"
            name="endsAt"
            type="datetime-local"
            className={inputCls(!!errs.endsAt)}
          />
          <FieldError message={errs.endsAt} />
        </div>

        {/* AI Tools */}
        <div className="md:col-span-2 mt-2">
          <p className="text-[11px] font-semibold tracking-[0.12em] text-ink-3 uppercase">AI Tools</p>
        </div>

        <div className="md:col-span-2 space-y-3">
          <AiSocialButton
            eventTitle=""
            category=""
            eventDate=""
            venue=""
            city=""
          />
        </div>

        <div className="md:col-span-2">
          <AiPricingButton
            eventTitle=""
            category=""
            venue=""
            city=""
          />
        </div>
      </div>

      <div className="rounded-xl border border-dashed border-line bg-paper-2/40 p-4 flex items-start gap-3">
        <span className="inline-flex w-9 h-9 items-center justify-center rounded-lg bg-paper ring-1 ring-line shrink-0">
          <ImageIcon size={15} className="text-ink-3" />
        </span>
        <div className="text-[13px] text-ink-2 leading-relaxed">
          <p className="font-semibold text-ink">Next: set up your ticket tiers.</p>
          <p className="mt-0.5">Once the draft is saved we&apos;ll take you straight to the tickets page to add tiers. The cover image, merch, and gallery are one click away.</p>
        </div>
      </div>

      <div className="flex items-center justify-between pt-2">
        <Link
          href="/organizer"
          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-2 hover:text-ink"
        >
          <ArrowLeft size={13} /> Back
        </Link>
        <SubmitButton />
      </div>
    </form>
  )
}
