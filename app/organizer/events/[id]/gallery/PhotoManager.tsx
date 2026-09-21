"use client"

import { useState, useTransition } from "react"
import { Trash2, Loader2 } from "lucide-react"

import ImageUploader from "@/components/ui/ImageUploader"
import { addGalleryPhotosAction, deleteGalleryPhotoAction } from "./actions"

type Photo = {
  id: string
  url: string
  caption: string | null
}

type Props = {
  eventId: string
  galleryId: string
  initialPhotos: Photo[]
}

export default function PhotoManager({ eventId, galleryId, initialPhotos }: Props) {
  const [photos, setPhotos] = useState<Photo[]>(initialPhotos)
  const [stagedUrls, setStagedUrls] = useState<string[]>([])
  const [busy, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const persistStaged = (urls: string[]) => {
    if (urls.length === 0) return
    setError(null)
    startTransition(async () => {
      const res = await addGalleryPhotosAction(galleryId, urls)
      if (!res.ok) {
        setError(res.error ?? "Failed to save photos.")
        return
      }
      // Optimistically remove the newly persisted urls from the staged list,
      // and append placeholder rows. The next page revalidation will replace
      // these with canonical DB rows.
      setStagedUrls((prev) => prev.filter((u) => !urls.includes(u)))
      setPhotos((prev) => [
        ...prev,
        ...urls.map((url) => ({
          id: `tmp-${Math.random().toString(36).slice(2, 10)}`,
          url,
          caption: null,
        })),
      ])
    })
  }

  return (
    <div className="space-y-5">
      <ImageUploader
        kind="event-gallery"
        eventId={eventId}
        multiple
        values={stagedUrls}
        onValuesChange={(next) => {
          // When new URLs arrive (uploader appended), persist them.
          const fresh = next.filter((u) => !stagedUrls.includes(u))
          setStagedUrls(next)
          if (fresh.length > 0) persistStaged(fresh)
        }}
        maxItems={50}
        aspectRatio="square"
        label="Add photos"
        helperText="Up to 50 per batch. 10 MB max each."
      />

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-[13px] text-rose-700">
          {error}
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-[13px] font-semibold text-ink">In this gallery</p>
          <p className="text-[12px] text-ink-3 inline-flex items-center gap-1.5">
            {busy && <Loader2 size={12} className="animate-spin" />}
            {photos.length} photo{photos.length === 1 ? "" : "s"}
          </p>
        </div>

        {photos.length === 0 ? (
          <p className="text-[13px] text-ink-3 px-1">No photos yet. Drop some files above.</p>
        ) : (
          <ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {photos.map((p) => (
              <li key={p.id} className="relative group rounded-xl overflow-hidden border border-line bg-paper aspect-square">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt={p.caption ?? ""} loading="lazy" className="absolute inset-0 w-full h-full object-cover" />
                {!p.id.startsWith("tmp-") && (
                  <form action={deleteGalleryPhotoAction}>
                    <input type="hidden" name="photoId" value={p.id} />
                    <input type="hidden" name="galleryId" value={galleryId} />
                    <input type="hidden" name="eventId" value={eventId} />
                    <button
                      type="submit"
                      title="Remove photo"
                      aria-label="Remove photo"
                      className="absolute top-1.5 right-1.5 inline-flex items-center justify-center w-7 h-7 rounded-md bg-paper/90 text-ink-2 hover:text-rose-600 hover:bg-paper shadow-sm transition opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 size={13} />
                    </button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
