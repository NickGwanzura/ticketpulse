"use client"

import { useActionState, useState } from "react"
import { useFormStatus } from "react-dom"
import { Save } from "lucide-react"

import Button from "@/components/ui/Button"
import ImageUploader from "@/components/ui/ImageUploader"
import { saveGalleryAction, type GalleryFormState } from "./actions"

const INITIAL: GalleryFormState = { ok: true }

function inputCls(hasError?: boolean) {
  return [
    "w-full rounded-xl border bg-paper px-3 py-2.5 text-[14px] text-ink",
    "placeholder:text-ink-3 focus:outline-none focus:ring-4",
    hasError
      ? "border-rose-300 focus:border-rose-400 focus:ring-rose-500/15"
      : "border-line focus:border-line-2 focus:ring-blue/15",
  ].join(" ")
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return <p className="mt-1 text-[12px] text-rose-600">{message}</p>
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" loading={pending} size="sm">
      <Save size={13} /> {pending ? "Saving…" : label}
    </Button>
  )
}

type Props = {
  eventId: string
  gallery?: {
    id: string
    name: string
    description: string | null
    coverImage: string | null
    packPrice: string | null
    currency: string | null
    isPublic: boolean | null
  }
  onDone?: () => void
}

export default function GalleryForm({ eventId, gallery, onDone }: Props) {
  const [state, formAction] = useActionState(saveGalleryAction, INITIAL)
  const [coverImage, setCoverImage] = useState<string | null>(gallery?.coverImage ?? null)
  const errs = state.fieldErrors ?? {}

  // Close the inline editor on successful save.
  if (state.ok && state.message && onDone) {
    // Defer to next tick to avoid setState during render warnings.
    setTimeout(onDone, 0)
  }

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="eventId" value={eventId} />
      {gallery && <input type="hidden" name="galleryId" value={gallery.id} />}
      <input type="hidden" name="coverImage" value={coverImage ?? ""} />

      {state.error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] text-rose-700">
          {state.error}
        </div>
      )}

      <ImageUploader
        kind="event-gallery"
        eventId={eventId}
        value={coverImage}
        onChange={(url) => setCoverImage(url)}
        aspectRatio="wide"
        label="Gallery cover"
        helperText="Optional. Shown in the event&apos;s photo strip."
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <label htmlFor="name" className="block text-[13px] font-medium text-ink mb-1.5">Name</label>
          <input id="name" name="name" type="text" required maxLength={120} defaultValue={gallery?.name ?? ""} placeholder="Saturday night" className={inputCls(!!errs.name)} />
          <FieldError message={errs.name} />
        </div>

        <div className="md:col-span-2">
          <label htmlFor="description" className="block text-[13px] font-medium text-ink mb-1.5">Description</label>
          <textarea id="description" name="description" rows={3} maxLength={2000} defaultValue={gallery?.description ?? ""} className={inputCls()} />
        </div>

        <div>
          <label htmlFor="packPrice" className="block text-[13px] font-medium text-ink mb-1.5">Pack price</label>
          <input id="packPrice" name="packPrice" type="number" min="0" step="0.01" defaultValue={gallery?.packPrice ?? ""} placeholder="0 for free" className={inputCls(!!errs.packPrice)} />
          <FieldError message={errs.packPrice} />
        </div>

        <div>
          <label htmlFor="currency" className="block text-[13px] font-medium text-ink mb-1.5">Currency</label>
          <select id="currency" name="currency" defaultValue={gallery?.currency ?? "USD"} className={inputCls()}>
            <option value="USD">USD</option>
            <option value="ZWL">ZWL</option>
            <option value="ZAR">ZAR</option>
            <option value="GBP">GBP</option>
          </select>
        </div>
      </div>

      <label className="flex items-center gap-2 text-[13px] text-ink">
        <input
          type="checkbox"
          name="isPublic"
          defaultChecked={gallery?.isPublic ?? true}
          className="h-4 w-4 rounded border-line text-navy focus:ring-blue/20"
        />
        Make gallery visible to attendees
      </label>

      <div className="flex items-center justify-end pt-2">
        <SubmitButton label={gallery ? "Save changes" : "Create gallery"} />
      </div>
    </form>
  )
}
