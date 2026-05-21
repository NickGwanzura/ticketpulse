"use client"

import { useActionState, useState, useEffect, useRef } from "react"
import { useFormStatus } from "react-dom"
import { AlertCircle, MapPin, Save, Trash2, Loader2 } from "lucide-react"

import Button from "@/components/ui/Button"
import ImageUploader from "@/components/ui/ImageUploader"
import VenueMap from "@/components/events/VenueMap"
import { geocodeFromLocation } from "@/lib/geocode"
import { updateEventAction, deleteEventAction, type UpdateEventState } from "./actions"

const INITIAL: UpdateEventState = { ok: true }

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

const STATUSES = [
  { value: "draft",     label: "Draft" },
  { value: "published", label: "Published" },
  { value: "sold_out",  label: "Sold out" },
  { value: "cancelled", label: "Cancelled" },
  { value: "completed", label: "Completed" },
] as const

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return (
    <p className="mt-1 text-[12px] text-rose-600 flex items-center gap-1" role="alert">
      <AlertCircle size={11} className="shrink-0" />
      {message}
    </p>
  )
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
      <Save size={14} /> {pending ? "Saving…" : "Save changes"}
    </Button>
  )
}

function DeleteButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" variant="destructive" size="md" loading={pending}>
      <Trash2 size={14} /> {pending ? "Deleting…" : "Delete event"}
    </Button>
  )
}

type Props = {
  event: {
    id: string
    title: string
    description: string | null
    category: string
    status: "draft" | "published" | "sold_out" | "cancelled" | "completed"
    venue: string
    city: string
    country: string | null
    address: string | null
    lat: string | null
    lng: string | null
    startsAt: Date
    endsAt: Date | null
    coverImage: string | null
    tags: string[] | null
  }
  showCreatedToast?: boolean
}

function toLocalInputValue(d: Date | null): string {
  if (!d) return ""
  // YYYY-MM-DDTHH:MM in local time
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function ReqMark() {
  return <span className="text-rose-500 ml-0.5" aria-label="required">*</span>
}

export default function EditEventForm({ event, showCreatedToast }: Props) {
  const [state, formAction] = useActionState(updateEventAction, INITIAL)
  const [coverImage, setCoverImage] = useState<string | null>(event.coverImage)
  const errs = state.fieldErrors ?? {}

  // Location fields (controlled for live geocoding preview)
  const [venue, setVenue] = useState(event.venue)
  const [city, setCity] = useState(event.city)
  const [country, setCountry] = useState(event.country ?? "Zimbabwe")
  const [address, setAddress] = useState(event.address ?? "")

  // Live-geocoded coordinates (from client-side Nominatim call)
  const [liveLat, setLiveLat] = useState<string | null>(event.lat)
  const [liveLng, setLiveLng] = useState<string | null>(event.lng)
  const [geocoding, setGeocoding] = useState(false)

  // Debounce geocoding: call Nominatim 600 ms after the user stops typing
  const geocodeTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => {
    if (!venue || !city) {
      setLiveLat(null)
      setLiveLng(null)
      return
    }

    if (geocodeTimer.current) clearTimeout(geocodeTimer.current)

    geocodeTimer.current = setTimeout(async () => {
      setGeocoding(true)
      const result = await geocodeFromLocation(venue, city, country, address)
      setLiveLat(result.lat?.toString() ?? null)
      setLiveLng(result.lng?.toString() ?? null)
      setGeocoding(false)
    }, 600)

    return () => {
      if (geocodeTimer.current) clearTimeout(geocodeTimer.current)
    }
  }, [venue, city, country, address])

  return (
    <div className="space-y-8">
      {showCreatedToast && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[13px] text-emerald-800" role="status">
          Draft created. Add a cover image and the rest of your details below.
        </div>
      )}

      <form action={formAction} className="space-y-6">
        <input type="hidden" name="id" value={event.id} />

        {state.error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] text-rose-700 flex items-center gap-2" role="alert">
            <AlertCircle size={14} className="shrink-0" />
            {state.error}
          </div>
        )}
        {state.ok && state.message && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[13px] text-emerald-800" role="status">
            {state.message}
          </div>
        )}

        <ImageUploader
          kind="event-cover"
          eventId={event.id}
          value={coverImage}
          onChange={(url) => setCoverImage(url)}
          aspectRatio="wide"
          label="Cover image"
          helperText="5 MB max. 16:9 looks best."
        />
        <input type="hidden" name="coverImage" value={coverImage ?? ""} />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="md:col-span-2">
            <label htmlFor="title" className="block text-[13px] font-medium text-ink mb-1.5">Title<ReqMark /></label>
            <input id="title" name="title" type="text" required maxLength={160} defaultValue={event.title} className={inputCls(!!errs.title)} />
            <FieldError message={errs.title} />
          </div>

          <div>
            <label htmlFor="category" className="block text-[13px] font-medium text-ink mb-1.5">Category<ReqMark /></label>
            <select id="category" name="category" required defaultValue={event.category} className={inputCls(!!errs.category)}>
              {!CATEGORIES.includes(event.category) && (
                <option value={event.category}>{event.category}</option>
              )}
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <FieldError message={errs.category} />
          </div>

          <div>
            <label htmlFor="status" className="block text-[13px] font-medium text-ink mb-1.5">Status</label>
            <select id="status" name="status" required defaultValue={event.status} className={inputCls(!!errs.status)}>
              {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
            <FieldError message={errs.status} />
          </div>

          <div className="md:col-span-2">
            <label htmlFor="description" className="block text-[13px] font-medium text-ink mb-1.5">Description</label>
            <textarea id="description" name="description" rows={4} maxLength={4000} defaultValue={event.description ?? ""} className={inputCls()} />
          </div>

          {/* Location */}
          <div className="md:col-span-2 mt-2">
            <p className="text-[11px] font-semibold tracking-[0.12em] text-ink-3 uppercase">Location</p>
          </div>

          <div>
            <label htmlFor="venue" className="block text-[13px] font-medium text-ink mb-1.5">Venue<ReqMark /></label>
            <input id="venue" name="venue" type="text" required maxLength={160} value={venue} onChange={(e) => setVenue(e.target.value)} className={inputCls(!!errs.venue)} />
            <FieldError message={errs.venue} />
          </div>

          <div>
            <label htmlFor="city" className="block text-[13px] font-medium text-ink mb-1.5">City<ReqMark /></label>
            <input id="city" name="city" type="text" required maxLength={80} value={city} onChange={(e) => setCity(e.target.value)} className={inputCls(!!errs.city)} />
            <FieldError message={errs.city} />
          </div>

          <div>
            <label htmlFor="country" className="block text-[13px] font-medium text-ink mb-1.5">Country</label>
            <input id="country" name="country" type="text" maxLength={80} value={country} onChange={(e) => setCountry(e.target.value)} className={inputCls(!!errs.country)} />
            <FieldError message={errs.country} />
          </div>

          <div>
            <label htmlFor="address" className="block text-[13px] font-medium text-ink mb-1.5">Address</label>
            <input id="address" name="address" type="text" maxLength={240} value={address} onChange={(e) => setAddress(e.target.value)} className={inputCls()} />
          </div>

          {/* Hidden lat/lng so the form can forward them on save too */}
          <input type="hidden" name="lat" value={liveLat ?? ""} />
          <input type="hidden" name="lng" value={liveLng ?? ""} />

          <div className="md:col-span-2">
            {geocoding && (
              <div className="rounded-xl border border-dashed border-line bg-paper-2/50 px-4 py-5 text-center">
                <Loader2 size={20} className="mx-auto mb-2 text-ink-3 animate-spin" />
                <p className="text-[13px] font-medium text-ink-2">Locating venue…</p>
              </div>
            )}
            {!geocoding && liveLat && liveLng ? (
              <VenueMap
                lat={liveLat}
                lng={liveLng}
                venue={venue}
                address={address}
                city={city}
              />
            ) : null}
            {!geocoding && !liveLat && !liveLng && (
              <div className="rounded-xl border border-dashed border-line bg-paper-2/50 px-4 py-5 text-center">
                <MapPin size={20} className="mx-auto mb-2 text-ink-3" />
                <p className="text-[13px] font-medium text-ink-2">Venue map</p>
                <p className="text-[12px] text-ink-3 mt-0.5">
                  Enter a venue and city to see the location on a map.
                </p>
              </div>
            )}
          </div>

          {/* Date & Time */}
          <div className="md:col-span-2 mt-2">
            <p className="text-[11px] font-semibold tracking-[0.12em] text-ink-3 uppercase">Date & Time</p>
          </div>

          <div>
            <label htmlFor="startsAt" className="block text-[13px] font-medium text-ink mb-1.5">Starts at<ReqMark /></label>
            <input id="startsAt" name="startsAt" type="datetime-local" required defaultValue={toLocalInputValue(event.startsAt)} className={inputCls(!!errs.startsAt)} />
            <FieldError message={errs.startsAt} />
          </div>

          <div>
            <label htmlFor="endsAt" className="block text-[13px] font-medium text-ink mb-1.5">Ends at</label>
            <input id="endsAt" name="endsAt" type="datetime-local" defaultValue={toLocalInputValue(event.endsAt)} className={inputCls(!!errs.endsAt)} />
            <FieldError message={errs.endsAt} />
          </div>

          <div className="md:col-span-2">
            <label htmlFor="tags" className="block text-[13px] font-medium text-ink mb-1.5">Tags</label>
            <input id="tags" name="tags" type="text" defaultValue={(event.tags ?? []).join(", ")} className={inputCls()} placeholder="afrobeat, outdoor, family" />
            <p className="mt-1 text-[11.5px] text-ink-3">Comma-separated. Up to 10.</p>
          </div>
        </div>

        <div className="flex items-center justify-end pt-2">
          <SubmitButton />
        </div>
      </form>

      <div className="border-t border-line pt-6">
        <h3 className="text-[13px] font-semibold text-ink mb-1.5">Danger zone</h3>
        <p className="text-[12.5px] text-ink-3 mb-3">Deleting this event removes its galleries, photos, and merch links. Sold tickets are kept for accounting.</p>
        <form
          action={deleteEventAction}
          onSubmit={(e) => {
            if (!confirm("Delete this event? This cannot be undone.")) e.preventDefault()
          }}
        >
          <input type="hidden" name="id" value={event.id} />
          <DeleteButton />
        </form>
      </div>
    </div>
  )
}
