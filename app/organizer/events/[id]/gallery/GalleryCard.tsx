"use client"

import { useState } from "react"
import { Pencil, X, Trash2, Eye, EyeOff } from "lucide-react"

import GalleryForm from "./GalleryForm"
import PhotoManager from "./PhotoManager"
import { deleteGalleryAction } from "./actions"
import { formatCurrency } from "@/lib/utils"

type Photo = {
  id: string
  url: string
  caption: string | null
}

type Gallery = {
  id: string
  name: string
  description: string | null
  coverImage: string | null
  packPrice: string | null
  currency: string | null
  isPublic: boolean | null
  photoCount: number | null
}

type Props = {
  eventId: string
  gallery: Gallery
  photos: Photo[]
}

export default function GalleryCard({ eventId, gallery, photos }: Props) {
  const [editing, setEditing] = useState(false)
  const price = gallery.packPrice ? Number.parseFloat(gallery.packPrice) : 0

  return (
    <div className="rounded-2xl border border-line bg-paper overflow-hidden">
      {/* Cover strip */}
      <div className="relative aspect-[4/1] bg-paper-2">
        {gallery.coverImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={gallery.coverImage} alt="" className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 grid place-items-center text-[12px] text-ink-3">
            No cover image yet
          </div>
        )}
      </div>

      <div className="p-5 md:p-6 space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <p className="text-[15.5px] font-semibold text-ink truncate">{gallery.name}</p>
              <span className={`inline-flex items-center gap-1 text-[10.5px] font-semibold tracking-wide uppercase px-2 py-0.5 rounded-full ${gallery.isPublic ? "bg-green-50 text-green-700" : "bg-paper-2 text-ink-2 ring-1 ring-line"}`}>
                {gallery.isPublic ? <Eye size={10} /> : <EyeOff size={10} />}
                {gallery.isPublic ? "Public" : "Hidden"}
              </span>
            </div>
            {gallery.description && (
              <p className="text-[12.5px] text-ink-2 line-clamp-2">{gallery.description}</p>
            )}
            <p className="text-[11.5px] text-ink-3 mt-1.5">
              {gallery.photoCount ?? 0} photos · {price > 0 ? `${formatCurrency(price, gallery.currency ?? "USD")} pack` : "Free pack"}
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setEditing((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-paper px-3 py-1.5 text-[12.5px] font-medium text-ink hover:border-line-2"
            >
              {editing ? <><X size={12} /> Cancel</> : <><Pencil size={12} /> Edit</>}
            </button>
            <form
              action={deleteGalleryAction}
              onSubmit={(e) => {
                if (!confirm(`Delete "${gallery.name}"? This removes all photos in it.`)) e.preventDefault()
              }}
            >
              <input type="hidden" name="galleryId" value={gallery.id} />
              <input type="hidden" name="eventId" value={eventId} />
              <button
                type="submit"
                title="Delete gallery"
                className="inline-flex items-center justify-center rounded-lg border border-line bg-paper p-1.5 text-ink-2 hover:text-rose-600 hover:border-rose-200"
              >
                <Trash2 size={13} />
              </button>
            </form>
          </div>
        </div>

        {editing && (
          <div className="rounded-xl border border-line bg-paper-2/40 p-5">
            <GalleryForm
              eventId={eventId}
              gallery={{
                id: gallery.id,
                name: gallery.name,
                description: gallery.description,
                coverImage: gallery.coverImage,
                packPrice: gallery.packPrice,
                currency: gallery.currency,
                isPublic: gallery.isPublic,
              }}
              onDone={() => setEditing(false)}
            />
          </div>
        )}

        <div className="border-t border-line pt-5">
          <PhotoManager eventId={eventId} galleryId={gallery.id} initialPhotos={photos} />
        </div>
      </div>
    </div>
  )
}
