"use client"

import { useActionState } from "react"
import { useFormStatus } from "react-dom"
import Link from "next/link"
import { ArrowLeft, ImageIcon, Save } from "lucide-react"

import Button from "@/components/ui/Button"
import { createEventAction, type CreateEventState } from "./actions"

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
      : "border-line focus:border-line-2 focus:ring-blue/15",
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

  return (
    <form action={formAction} className="space-y-6">
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
          <input
            id="tags"
            name="tags"
            type="text"
            placeholder="afrobeat, outdoor, family"
            className={inputCls()}
          />
          <p className="mt-1 text-[11.5px] text-ink-3">Comma-separated. Up to 10.</p>
        </div>

        <div className="md:col-span-2">
          <label htmlFor="description" className="block text-[13px] font-medium text-ink mb-1.5">Description</label>
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
