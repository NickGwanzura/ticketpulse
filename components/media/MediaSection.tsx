"use client"
import Image from "next/image"
import { Camera, Download, Lock } from "lucide-react"
import { formatCurrency } from "@/lib/utils"
import type { GalleryWithPhotos } from "@/types"
import { useState } from "react"

interface MediaSectionProps {
  galleries: GalleryWithPhotos[]
  eventTitle: string
}

export default function MediaSection({ galleries, eventTitle }: MediaSectionProps) {
  const [activeGallery, setActiveGallery] = useState<string | null>(galleries[0]?.id ?? null)

  if (!galleries.length) return null

  const current = galleries.find((g) => g.id === activeGallery) ?? galleries[0]

  return (
    <section>
      <div className="flex items-center gap-3 mb-6">
        <span className="inline-flex w-9 h-9 items-center justify-center rounded-xl bg-blue-soft ring-1 ring-blue/15">
          <Camera size={16} className="text-blue" />
        </span>
        <div>
          <p className="text-[11px] font-semibold tracking-[0.18em] text-blue uppercase">Photo gallery</p>
          <h2 className="text-[18px] font-semibold tracking-tight text-ink">{eventTitle}</h2>
        </div>
      </div>

      {galleries.length > 1 && (
        <div className="flex gap-2 mb-5 flex-wrap">
          {galleries.map((g) => (
            <button
              key={g.id}
              onClick={() => setActiveGallery(g.id)}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                activeGallery === g.id
                  ? "bg-navy text-white border-navy"
                  : "border-line bg-paper text-ink-2 hover:text-ink hover:border-line-2"
              }`}
            >
              {g.name} ({g.photoCount})
            </button>
          ))}
        </div>
      )}

      {current && (
        <>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-ink-2">{current.photoCount} photos</p>
            {current.packPrice && (
              <button className="inline-flex items-center gap-2 bg-navy text-white text-xs font-semibold px-4 py-2 rounded-lg hover:bg-navy-700 transition-colors">
                <Download size={13} />
                Download pack · {formatCurrency(current.packPrice, current.currency)}
              </button>
            )}
          </div>

          {current.photos.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
              {current.photos.map((photo, i) => (
                <div key={photo.id} className="aspect-square bg-paper-2 rounded-lg overflow-hidden relative group cursor-pointer ring-1 ring-line">
                  <Image
                    src={photo.thumbnailUrl ?? photo.url}
                    alt={photo.caption ?? `Event photo ${i + 1}`}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-300"
                    sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
                  />
                  <div className="absolute inset-0 bg-ink/45 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Download size={20} className="text-white" />
                  </div>
                  {photo.caption && (
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-ink/80 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <p className="text-white text-[10px] line-clamp-2">{photo.caption}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="border border-dashed border-line rounded-2xl p-12 text-center bg-paper-2">
              <div className="mx-auto mb-3 inline-flex w-12 h-12 items-center justify-center rounded-full bg-paper ring-1 ring-line">
                <Camera size={20} className="text-ink-3" />
              </div>
              <p className="text-sm font-medium text-ink mb-1">Photos coming soon</p>
              <p className="text-xs text-ink-2">They&apos;ll be uploaded after the event.</p>
            </div>
          )}

          {current.packPrice && current.photos.length > 0 && (
            <div className="mt-4 flex items-center gap-3 rounded-2xl border border-line bg-paper p-5">
              <Lock size={16} className="text-ink-3" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-ink">Want high-resolution downloads?</p>
                <p className="text-xs text-ink-2">Purchase the full photo pack to download all {current.photoCount} photos in full quality.</p>
              </div>
              <button className="bg-navy text-white text-xs font-semibold px-4 py-2 rounded-lg hover:bg-navy-700 transition-colors shrink-0">
                {formatCurrency(current.packPrice, current.currency)}
              </button>
            </div>
          )}
        </>
      )}
    </section>
  )
}
