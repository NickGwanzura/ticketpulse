"use client"

import { useActionState, useState, useEffect, useRef } from "react"
import { useFormStatus } from "react-dom"
import Link from "next/link"
import { AlertCircle, MapPin, Save, Trash2, Loader2, Sparkles, Ticket } from "lucide-react"

import Button from "@/components/ui/Button"
import ImageUploader from "@/components/ui/ImageUploader"
import VenueMap from "@/components/events/VenueMap"
import { updateEventAction, type UpdateEventState } from "./actions"
import { deleteTierAction } from "../tiers/actions"
import { formatCurrency } from "@/lib/utils"
import AiModerateButton from "@/components/ai/AiModerateButton"
import AiTagSuggest from "@/components/ai/AiTagSuggest"
import AiSocialButton from "@/components/ai/AiSocialButton"
import AiPricingButton from "@/components/ai/AiPricingButton"
import DeleteEventForm from "../../DeleteEventForm"

const INITIAL: UpdateEventState = { ok: true }

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
      : "border-line focus:border-line-2 focus:ring-brand-500/15",
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

type TierSummary = {
  id: string
  name: string
  price: string
  currency: string | null
  totalQuantity: number
  soldQuantity: number | null
  description: string | null
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
    googleMapsUrl: string | null
    hideOrganizerName: boolean | null
    faq: string | null
    promoImages: string[] | null
  }
  tiers: TierSummary[]
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

export default function EditEventForm({ event, tiers, showCreatedToast }: Props) {
  const [state, formAction] = useActionState(updateEventAction, INITIAL)
  const [coverImage, setCoverImage] = useState<string | null>(event.coverImage)
  const [promoImages, setPromoImages] = useState<string[]>(event.promoImages ?? [])
  const [hideOrganizer, setHideOrganizer] = useState(event.hideOrganizerName ?? false)
  const errs = state.fieldErrors ?? {}

  const [genDesc, setGenDesc] = useState(false)
  const [genLoc, setGenLoc] = useState(false)
  const [descError, setDescError] = useState("")
  const [locError, setLocError] = useState("")
  const [selectedStatus, setSelectedStatus] = useState(event.status)
  const [deletingTier, setDeletingTier] = useState<{ id: string; name: string } | null>(null)
  const [tags, setTags] = useState<string[]>(event.tags ?? [])

  async function handleGenerateDesc() {
    const title = (document.getElementById("title") as HTMLInputElement | null)?.value ?? event.title
    const category = (document.getElementById("category") as HTMLSelectElement | null)?.value ?? event.category
    const venueEl = document.getElementById("venue") as HTMLInputElement | null
    const cityEl = document.getElementById("city") as HTMLInputElement | null
    const venue = venueEl?.value ?? event.venue
    const city = cityEl?.value ?? event.city
    const tags = (document.getElementById("tags") as HTMLInputElement | null)?.value ?? ""

    if (!title || !category || !venue || !city) {
      setDescError("Title, category, venue, and city are required.")
      return
    }

    setDescError("")
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

  async function handleSuggestLocation() {
    const venueEl = document.getElementById("venue") as HTMLInputElement | null
    const cityEl = document.getElementById("city") as HTMLInputElement | null
    const venue = venueEl?.value ?? event.venue
    const city = cityEl?.value ?? event.city

    if (!venue || !city) {
      setLocError("Venue and city are required.")
      return
    }

    setLocError("")
    setGenLoc(true)
    try {
      const res = await fetch("/api/ai/location", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ venue, city }),
      })
      const data = await res.json()
      if (data.country) {
        setCountry(data.country)
      }
      if (data.address) {
        setAddress(data.address)
      }
    } catch {
      // silently fail
    } finally {
      setGenLoc(false)
    }
  }

  // Location fields (controlled for live geocoding preview)
  const [venue, setVenue] = useState(event.venue)
  const [city, setCity] = useState(event.city)
  const [country, setCountry] = useState(event.country ?? "Zimbabwe")
  const [address, setAddress] = useState(event.address ?? "")

  // Live-geocoded coordinates (from client-side Nominatim call)
  const [liveLat, setLiveLat] = useState<string | null>(event.lat)
  const [liveLng, setLiveLng] = useState<string | null>(event.lng)
  const [geocoding, setGeocoding] = useState(false)
  const [geocodeNotFound, setGeocodeNotFound] = useState(false)

  // Build the search query string for display
  const searchQuery = [venue, address, city, country].filter(Boolean).join(", ")

  // Debounce geocoding: call Nominatim 1.2 s after the user stops typing
  // Increased from 600ms to 1200ms to reduce mid-typing interruptions
  const geocodeTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const lastGeoQuery = useRef("")

  useEffect(() => {
    if (!venue || !city) {
      setLiveLat(null)
      setLiveLng(null)
      setGeocodeNotFound(false)
      return
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
    <div className="space-y-8">
      {showCreatedToast && (
        <div className="rounded-xl border border-brand-200 bg-green-50 px-4 py-3 text-[13px] text-green-800" role="status">
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
          <div className="rounded-xl border border-brand-200 bg-green-50 px-4 py-3 text-[13px] text-green-800" role="status">
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

        <ImageUploader
          kind="event-promo"
          eventId={event.id}
          multiple={true}
          values={promoImages}
          onValuesChange={setPromoImages}
          maxItems={6}
          aspectRatio="wide"
          label="Additional photos"
          helperText="Up to 6 photos shown in a gallery on the event page. Drag to reorder."
        />
        <input type="hidden" name="promoImages" value={JSON.stringify(promoImages)} />

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
            <select id="status" name="status" required defaultValue={event.status} onChange={(e) => setSelectedStatus(e.target.value as typeof selectedStatus)} className={inputCls(!!errs.status)}>
              {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
            <FieldError message={errs.status} />
            {(selectedStatus === "cancelled" || selectedStatus === "completed") && (
              <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-800">
                Setting status to <strong>{selectedStatus}</strong> will hide this event from public listings. Buyers will still be able to view their tickets.
              </p>
            )}
          </div>

          <div className="md:col-span-2">
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="description" className="block text-[13px] font-medium text-ink">Description</label>
              <div className="flex items-center gap-3">
                <AiModerateButton
                  title={event.title}
                  description={event.description ?? ""}
                  category={event.category}
                />
                <button
                  type="button"
                  onClick={handleGenerateDesc}
                  disabled={genDesc}
                  className="inline-flex items-center gap-1 text-[12px] font-medium text-blue hover:text-brand-600/80 transition-colors disabled:opacity-50"
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
            {descError && <p className="mb-1.5 text-[12px] text-rose-600">{descError}</p>}
            <textarea id="description" name="description" rows={4} maxLength={4000} defaultValue={event.description ?? ""} className={inputCls()} />
          </div>

          {/* Visibility & FAQ */}
          <div className="md:col-span-2 mt-2">
            <p className="text-[11px] font-semibold tracking-[0.12em] text-ink-3 uppercase">Visibility & Details</p>
          </div>

          <div className="md:col-span-2">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                name="hideOrganizerName"
                checked={hideOrganizer}
                onChange={(e) => setHideOrganizer(e.target.checked)}
                className="w-4 h-4 rounded border-line text-navy focus:ring-navy/20"
              />
              <span className="text-[13px] text-ink">Hide my name from the event page</span>
            </label>
            <p className="mt-1 text-[12px] text-ink-3 ml-7">Attendees won&apos;t see &quot;Organized by [your name]&quot; on the public page.</p>
          </div>

          <div className="md:col-span-2">
            <label htmlFor="faq" className="block text-[13px] font-medium text-ink mb-1.5">More About This Event <span className="text-ink-3 font-normal">(optional)</span></label>
            <textarea
              id="faq"
              name="faq"
              rows={6}
              maxLength={8000}
              defaultValue={event.faq ?? ""}
              placeholder="FAQ, what to bring, dress code, parking info, refund policy, accessibility details..."
              className={inputCls()}
            />
            <p className="mt-1 text-[12px] text-ink-3">This appears in a dedicated section on the event page. Great for FAQs and extra details.</p>
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

          <div className="md:col-span-2">
            <button
              type="button"
              onClick={handleSuggestLocation}
              disabled={genLoc}
              className="inline-flex items-center gap-1.5 text-[12px] font-medium text-blue hover:text-brand-600/80 transition-colors disabled:opacity-50"
            >
              {genLoc ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <MapPin size={13} />
              )}
              {genLoc ? "Looking up location…" : "Suggest country & address from venue"}
            </button>
            {locError && <p className="mt-1 text-[12px] text-rose-600">{locError}</p>}
          </div>

          {/* Hidden lat/lng so the form can forward them on save too */}
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

          {/* Date & Time */}
          {/* Google Maps URL */}
          <div className="md:col-span-2">
            <label htmlFor="googleMapsUrl" className="block text-[13px] font-medium text-ink mb-1.5">Google Maps link <span className="text-ink-3 font-normal">(optional)</span></label>
            <input
              id="googleMapsUrl"
              name="googleMapsUrl"
              type="url"
              placeholder="https://maps.google.com/?q=..."
              defaultValue={event.googleMapsUrl ?? ""}
              className={inputCls()}
            />
            <p className="mt-1 text-[12px] text-ink-3">Paste a Google Maps URL for this venue. If not provided, one will be auto-generated from coordinates.</p>
          </div>

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
            <input id="tags" name="tags" type="hidden" value={tags.join(", ")} />
            <AiTagSuggest
              title={event.title}
              description={event.description ?? ""}
              category={event.category}
              existingTags={tags}
              onTagsChange={setTags}
            />
            <p className="mt-1 text-[12px] text-ink-3">Up to 10. AI-suggested tags appear below.</p>
          </div>

          {/* AI Tools */}
          <div className="md:col-span-2 mt-2">
            <p className="text-[11px] font-semibold tracking-[0.12em] text-ink-3 uppercase">AI Tools</p>
          </div>

          <div className="md:col-span-2 space-y-3">
            <AiSocialButton
              eventTitle={event.title}
              category={event.category}
              eventDate={event.startsAt.toLocaleDateString()}
              venue={event.venue}
              city={event.city}
            />
          </div>

          <div className="md:col-span-2">
            <AiPricingButton
              eventTitle={event.title}
              category={event.category}
              venue={event.venue}
              city={event.city}
            />
          </div>
        </div>

        <div className="flex items-center justify-end pt-2">
          <SubmitButton />
        </div>
      </form>

      {/* Ticket types */}
      <div className="border-t border-line pt-6">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-[13px] font-semibold text-ink">Ticket types</h3>
            <p className="text-[13px] text-ink-3 mt-0.5">
              {tiers.length} tier{tiers.length !== 1 ? "s" : ""} created
            </p>
          </div>
          <Link
            href={`/organizer/events/${event.id}/tiers`}
            className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-paper px-4 py-2 text-[13px] font-medium text-ink hover:border-line-2 active:scale-[0.99] transition"
          >
            <Ticket size={13} /> Manage tiers
          </Link>
        </div>

        {tiers.length === 0 ? (
          <div className="rounded-xl border border-dashed border-line bg-paper-2/50 px-4 py-6 text-center">
            <Ticket size={24} className="mx-auto mb-2 text-ink-3" />
            <p className="text-[13px] font-medium text-ink-2">No ticket types yet</p>
            <p className="text-[12px] text-ink-3 mt-1">
              <Link href={`/organizer/events/${event.id}/tiers`} className="text-blue hover:underline">
                Create at least one tier
              </Link>{" "}
              so people can buy tickets.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {tiers.map((t) => {
              const sold = t.soldQuantity ?? 0
              const price = Number.parseFloat(t.price) || 0
              return (
                <div
                  key={t.id}
                  className="flex items-center gap-3 rounded-xl border border-line bg-paper p-3"
                >
                  <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-green-50 text-navy shrink-0">
                    <Ticket size={13} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium text-ink truncate">{t.name}</p>
                    <p className="text-[12px] text-ink-3">
                      {formatCurrency(price, t.currency ?? "USD")} · {t.totalQuantity.toLocaleString()} capacity · {sold.toLocaleString()} sold
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => { if (sold === 0) setDeletingTier({ id: t.id, name: t.name }) }}
                    title={sold > 0 ? "Can't delete — has sales" : "Delete tier"}
                    disabled={sold > 0}
                    className="inline-flex items-center justify-center rounded-lg border border-line bg-paper p-1.5 text-ink-2 hover:text-rose-600 hover:border-rose-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    aria-label="Delete tier"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="border border-rose-200 rounded-2xl p-5 md:p-6">
        <h3 className="text-[13px] font-semibold text-ink mb-1.5">Danger zone</h3>
        <p className="text-[13px] text-ink-3 mb-3">
          Delete is only available before an event has orders, tickets, or payment records. Events with buyer activity should be cancelled instead.
        </p>
        <DeleteEventForm eventId={event.id} eventTitle={event.title} />
      </div>

      {/* Tier delete confirmation modal */}
      {deletingTier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl border border-line bg-paper p-6 shadow-2xl">
            <p className="text-[16px] font-semibold text-ink mb-1">Delete &ldquo;{deletingTier.name}&rdquo;?</p>
            <p className="text-[13px] text-ink-2 mb-6">This action cannot be undone.</p>
            <div className="flex items-center gap-2 justify-end">
              <button
                type="button"
                onClick={() => setDeletingTier(null)}
                className="rounded-xl border border-line bg-paper px-4 py-2.5 text-[13px] font-medium text-ink hover:border-line-2 transition-colors min-h-[44px]"
              >
                Cancel
              </button>
              <form action={deleteTierAction} onSubmit={() => setDeletingTier(null)}>
                <input type="hidden" name="tierId" value={deletingTier.id} />
                <input type="hidden" name="eventId" value={event.id} />
                <button
                  type="submit"
                  className="rounded-xl bg-rose-600 px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-rose-700 transition-colors min-h-[44px]"
                >
                  Delete tier
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
