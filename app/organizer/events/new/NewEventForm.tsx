"use client"

import { useActionState, useState, useEffect, useRef } from "react"
import { useFormStatus } from "react-dom"
import Link from "next/link"
import { ArrowLeft, ArrowRight, Ticket, Save, Loader2, MapPin, Check } from "lucide-react"

import Button from "@/components/ui/Button"
import VenueMap from "@/components/events/VenueMap"
import { createEventAction, type CreateEventState } from "./actions"
import AiModerateButton from "@/components/ai/AiModerateButton"
import AiTagSuggest from "@/components/ai/AiTagSuggest"
import AiSocialButton from "@/components/ai/AiSocialButton"
import AiPricingButton from "@/components/ai/AiPricingButton"
import AiDescriptionButton from "@/components/ai/AiDescriptionButton"
import AiLocationSuggestButton from "@/components/ai/AiLocationSuggestButton"

const INITIAL: CreateEventState = { ok: true }

const CATEGORIES = [
  "Concert",
  "Festival",
  "Food & Drink",
  "Cocktail Experience",
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
      : "border-line focus:border-line-2 focus:ring-brand-500/15",
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

const STEPS = ["Basics", "Location", "Schedule", "Review"] as const

function Stepper({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-2 mb-2">
      {STEPS.map((label, i) => {
        const done = i < current
        const active = i === current
        return (
          <div key={label} className="flex items-center gap-2 flex-1">
            <div className="flex items-center gap-2 min-w-0">
              <span
                className={`shrink-0 inline-flex items-center justify-center w-6 h-6 rounded-full text-[11px] font-bold ${
                  done ? "bg-navy text-white" : active ? "bg-navy/10 text-navy ring-1 ring-navy" : "bg-paper-2 text-ink-3 ring-1 ring-line"
                }`}
              >
                {done ? <Check size={12} /> : i + 1}
              </span>
              <span className={`text-[12.5px] font-medium truncate ${active ? "text-ink" : "text-ink-3"}`}>{label}</span>
            </div>
            {i < STEPS.length - 1 && <div className={`h-px flex-1 ${done ? "bg-navy" : "bg-line"}`} />}
          </div>
        )
      })}
    </div>
  )
}

export default function NewEventForm() {
  const [state, formAction] = useActionState(createEventAction, INITIAL)
  const errs = state.fieldErrors ?? {}

  const [step, setStep] = useState(0)
  const formRef = useRef<HTMLFormElement>(null)

  // Advancing re-validates only the currently-visible step's required fields —
  // fields on hidden (display:none) steps are excluded from constraint
  // validation by the browser, so this never blocks on a future step's fields.
  function goNext() {
    if (formRef.current && !formRef.current.reportValidity()) return
    setStep((s) => Math.min(s + 1, STEPS.length - 1))
    window.scrollTo({ top: 0, behavior: "smooth" })
  }
  function goBack() {
    setStep((s) => Math.max(s - 1, 0))
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  const [tags, setTags] = useState<string[]>([])

  // Tracked for AI button context
  const [title, setTitle] = useState("")
  const [category, setCategory] = useState("")
  const [startsAt, setStartsAt] = useState("")
  const [description, setDescription] = useState("")

  // Location fields (controlled for live geocoding preview)
  const [venue, setVenue] = useState("")
  const [city, setCity] = useState("")
  const [country, setCountry] = useState("Zimbabwe")
  const [address, setAddress] = useState("")

  // Live-geocoded coordinates (from client-side Nominatim call)
  const [liveLat, setLiveLat] = useState<string | null>(null)
  const [liveLng, setLiveLng] = useState<string | null>(null)
  const [geocoding, setGeocoding] = useState(false)
  const [geocodeNotFound, setGeocodeNotFound] = useState(false)

  const searchQuery = [venue, address, city, country].filter(Boolean).join(", ")

  // Debounce geocoding: call Nominatim 1.2 s after the user stops typing
  // Increased from 600ms to 1200ms to reduce mid-typing interruptions
  const geocodeTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const lastGeoQuery = useRef("")

  useEffect(() => {
    const isTBA = (s: string) => s.trim().toLowerCase() === "tba"
    if (!venue || !city || isTBA(venue) || isTBA(city)) {
      const resetTimer = setTimeout(() => {
        setLiveLat(null)
        setLiveLng(null)
        setGeocodeNotFound(false)
      }, 0)
      return () => clearTimeout(resetTimer)
    }

    if (geocodeTimer.current) clearTimeout(geocodeTimer.current)

    const q = [venue, address, city, country].filter(Boolean).join(",")
    if (q === lastGeoQuery.current) return // unchanged
    lastGeoQuery.current = q

    geocodeTimer.current = setTimeout(async () => {
      setGeocoding(true)
      setGeocodeNotFound(false)
      const params = new URLSearchParams({ venue, city, country })
      if (address) params.set("address", address)
      try {
        const res = await fetch(`/api/geocode?${params}`)
        const result: { lat: number | null; lng: number | null } = await res.json()
        setLiveLat(result.lat?.toString() ?? null)
        setLiveLng(result.lng?.toString() ?? null)
        setGeocodeNotFound(result.lat === null || result.lng === null)
      } catch {
        // silently fail — geocoding is optional
      } finally {
        setGeocoding(false)
      }
    }, 1200)

    return () => {
      if (geocodeTimer.current) clearTimeout(geocodeTimer.current)
    }
  }, [venue, city, country, address])


  return (
    <form id="new-event-form" ref={formRef} action={formAction} className="space-y-6">
      <Stepper current={step} />

      {state.error && (
        <div role="alert" aria-live="polite" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] text-rose-700">
          {state.error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* ── Step 1: Basics ── */}
        <div className={step === 0 ? "contents" : "hidden"}>
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
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <FieldError message={errs.title} />
        </div>

        <div>
          <label htmlFor="category" className="block text-[13px] font-medium text-ink mb-1.5">Category</label>
          <select
            id="category"
            name="category"
            required
            value={category}
            onChange={(e) => setCategory(e.target.value)}
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
            title={title}
            description={description}
            category={category}
            existingTags={tags}
            onTagsChange={setTags}
          />
          <p className="mt-1 text-[12px] text-ink-3">Up to 10. AI-suggested tags appear below.</p>
        </div>

        <div className="md:col-span-2">
          <div className="flex items-center justify-between mb-1.5">
            <label htmlFor="description" className="block text-[13px] font-medium text-ink">Description</label>
            <div className="flex items-center gap-3">
              <AiModerateButton title="" description="" category="" />
              <AiDescriptionButton
                title={title}
                category={category}
                venue={venue}
                city={city}
                tags={tags.join(", ")}
                onGenerated={(description) => {
                  setDescription(description)
                }}
              />
            </div>
          </div>
          <textarea
            id="description"
            name="description"
            rows={4}
            maxLength={4000}
            placeholder="What should attendees expect?"
            className={inputCls()}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div className="md:col-span-2">
          <details className="group rounded-xl border border-line bg-paper-2/40 px-4 py-3">
            <summary className="cursor-pointer list-none text-[13px] font-semibold text-ink flex items-center justify-between">
              Additional details <span className="text-ink-3 text-[12px] font-normal group-open:hidden">Optional</span>
            </summary>
            <div className="mt-4 space-y-4">
              <div>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    name="hideOrganizerName"
                    className="w-4 h-4 rounded border-line text-navy focus:ring-navy/20"
                  />
                  <span className="text-[13px] text-ink">Hide my name from the event page</span>
                </label>
                <p className="mt-1 text-[12px] text-ink-3 ml-7">Attendees won&apos;t see who organized the event.</p>
              </div>
              <div>
                <label htmlFor="faq" className="block text-[13px] font-medium text-ink mb-1.5">Event notes <span className="text-ink-3 font-normal">(optional)</span></label>
                <textarea
                  id="faq"
                  name="faq"
                  rows={4}
                  maxLength={8000}
                  placeholder="What to bring, dress code, parking, refund or accessibility details…"
                  className={inputCls()}
                />
                <p className="mt-1 text-[12px] text-ink-3">Shown in a dedicated section on the public event page.</p>
              </div>
            </div>
          </details>
        </div>

        </div>
        {/* ── Step 2: Location ── */}
        <div className={step === 1 ? "contents" : "hidden"}>
        <div className="md:col-span-2 mt-2">
          <p className="text-[11px] font-semibold tracking-[0.12em] text-ink-3 uppercase">Location</p>
        </div>

        <div>
          <label htmlFor="venue" className="block text-[13px] font-medium text-ink mb-1.5">Venue <span className="text-ink-3 font-normal">(or TBA)</span></label>
          <input
            id="venue"
            name="venue"
            type="text"
            required
            maxLength={160}
            placeholder="HICC or TBA"
            value={venue}
            onChange={(e) => setVenue(e.target.value)}
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
            value={city}
            onChange={(e) => setCity(e.target.value)}
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
            maxLength={80}
            value={country}
            onChange={(e) => setCountry(e.target.value)}
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
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className={inputCls()}
          />
        </div>

        <div className="md:col-span-2">
          <AiLocationSuggestButton
            venue={venue}
            city={city}
            onGenerated={(result) => {
              if (result.country) {
                setCountry(result.country)
              }
              if (result.address) {
                setAddress(result.address)
              }
            }}
          />
        </div>

        {/* Hidden lat/lng forwarded to server action */}
        <input type="hidden" name="lat" value={liveLat ?? ""} />
        <input type="hidden" name="lng" value={liveLng ?? ""} />

        <div className="md:col-span-2">
          {geocoding && (
            <div className="rounded-xl border border-dashed border-line bg-paper-2/50 px-4 py-5 text-center">
              <Loader2 size={20} className="mx-auto mb-2 text-ink-3 animate-spin" />
              <p className="text-[13px] font-medium text-ink-2">Locating venue…</p>
              <p className="text-[11px] text-ink-3 mt-1 truncate max-w-xs mx-auto">{searchQuery}</p>
            </div>
          )}
          {!geocoding && liveLat && liveLng && (
            <VenueMap
              lat={liveLat}
              lng={liveLng}
              venue={venue}
              address={address}
              city={city}
              country={country}
            />
          )}
          {!geocoding && geocodeNotFound && !liveLat && !liveLng && (
            <div className="rounded-xl border border-dashed border-amber-200 bg-amber-50/50 px-4 py-5 text-center">
              <MapPin size={20} className="mx-auto mb-2 text-ink-3" />
              <p className="text-[13px] font-medium text-ink-2">Location not found</p>
              <p className="text-[11px] text-ink-3 mt-1 truncate max-w-xs mx-auto">{searchQuery}</p>
              <p className="text-[11px] text-ink-3 mt-0.5">
                Try a more specific venue name or address.
              </p>
            </div>
          )}
          {!geocoding && !geocodeNotFound && !liveLat && !liveLng && (
            <div className="rounded-xl border border-dashed border-line bg-paper-2/50 px-4 py-5 text-center">
              <MapPin size={20} className="mx-auto mb-2 text-ink-3" />
              <p className="text-[13px] font-medium text-ink-2">Venue map</p>
              <p className="text-[12px] text-ink-3 mt-0.5">
                Enter a venue and city to see the location on a map.
              </p>
            </div>
          )}
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
          <p className="mt-1 text-[12px] text-ink-3">Paste a Google Maps URL for this venue. If not provided, one will be auto-generated from coordinates.</p>
        </div>

        </div>
        {/* ── Step 3: Schedule ── */}
        <div className={step === 2 ? "contents" : "hidden"}>
        <div>
          <label htmlFor="startsAt" className="block text-[13px] font-medium text-ink mb-1.5">Starts at</label>
          <input
            id="startsAt"
            name="startsAt"
            type="datetime-local"
            required
            className={inputCls(!!errs.startsAt)}
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
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

        {/* AI Tools — always visible, disabled until minimum fields are filled */}
        <div className="md:col-span-2 mt-2">
          <p className="text-[11px] font-semibold tracking-[0.12em] text-ink-3 uppercase">AI Tools</p>
          {!(title && category && venue && city) && (
            <p className="mt-1 text-[12px] text-ink-3">Fill in title, category, venue, and city to unlock AI tools.</p>
          )}
        </div>

        <div className={`md:col-span-2 space-y-3 ${!(title && category && venue && city) ? "pointer-events-none opacity-40" : ""}`}>
          <AiSocialButton
            eventTitle={title}
            category={category}
            eventDate={startsAt ? new Date(startsAt).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) : ""}
            venue={venue}
            city={city}
          />
        </div>

        <div className={`md:col-span-2 ${!(title && category && venue && city) ? "pointer-events-none opacity-40" : ""}`}>
          <AiPricingButton
            eventTitle={title}
            category={category}
            venue={venue}
            city={city}
          />
        </div>
        </div>
      </div>

      {/* ── Step 4: Review ── */}
      <div className={step === 3 ? "" : "hidden"}>
        <div className="rounded-xl border border-line bg-paper-2/60 p-5 space-y-3 mb-4">
          <p className="text-[13px] font-semibold text-ink">Review before creating</p>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-[13px]">
            <div className="flex justify-between sm:block"><dt className="text-ink-3">Title</dt><dd className="font-medium text-ink truncate sm:mt-0.5">{title || "—"}</dd></div>
            <div className="flex justify-between sm:block"><dt className="text-ink-3">Category</dt><dd className="font-medium text-ink sm:mt-0.5">{category || "—"}</dd></div>
            <div className="flex justify-between sm:block"><dt className="text-ink-3">Venue / City</dt><dd className="font-medium text-ink truncate sm:mt-0.5">{[venue, city].filter(Boolean).join(", ") || "—"}</dd></div>
            <div className="flex justify-between sm:block"><dt className="text-ink-3">Starts</dt><dd className="font-medium text-ink sm:mt-0.5">{startsAt ? new Date(startsAt).toLocaleString("en-GB") : "—"}</dd></div>
          </dl>
        </div>
        <div className="rounded-xl border border-dashed border-line bg-paper-2/40 p-4 flex items-start gap-3">
          <span className="inline-flex w-9 h-9 items-center justify-center rounded-lg bg-paper ring-1 ring-line shrink-0">
            <Ticket size={15} className="text-ink-3" />
          </span>
          <div className="text-[13px] text-ink-2 leading-relaxed">
            <p className="font-semibold text-ink">Next: set up your ticket tiers.</p>
            <p className="mt-0.5">Once the draft is saved we&apos;ll take you straight to the tickets page to add tiers. The cover image, merch, and gallery are one click away.</p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between pt-2">
        {step === 0 ? (
          <Link
            href="/organizer"
            className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-2 hover:text-ink"
          >
            <ArrowLeft size={13} /> Back
          </Link>
        ) : (
          <button
            type="button"
            onClick={goBack}
            className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-2 hover:text-ink"
          >
            <ArrowLeft size={13} /> Back
          </button>
        )}
        {step < STEPS.length - 1 ? (
          <Button type="button" size="md" onClick={goNext}>
            Next <ArrowRight size={14} />
          </Button>
        ) : (
          <SubmitButton />
        )}
      </div>
    </form>
  )
}
