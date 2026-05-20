"use client"

import { MapPin } from "lucide-react"

interface VenueMapProps {
  lat: number | string
  lng: number | string
  venue: string
  address?: string | null
  city?: string | null
}

/**
 * Interactive venue map using an OpenStreetMap embed iframe.
 * Zero external dependencies — works with any lat/lng pair.
 */
export default function VenueMap({ lat, lng, venue, address, city }: VenueMapProps) {
  const latNum = typeof lat === "string" ? parseFloat(lat) : lat
  const lngNum = typeof lng === "string" ? parseFloat(lng) : lng

  if (isNaN(latNum) || isNaN(lngNum)) return null

  // Build a bounding box ~0.02° around the point (roughly 2 km)
  const padding = 0.02
  const bbox = `${lngNum - padding},${latNum - padding},${lngNum + padding},${latNum + padding}`

  const embedUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${latNum},${lngNum}`
  const linkUrl = `https://www.openstreetmap.org/?mlat=${latNum}&mlng=${lngNum}#map=15/${latNum}/${lngNum}`

  const locationStr = [address, city].filter(Boolean).join(", ")

  return (
    <section>
      <h3 className="text-[13px] font-semibold text-ink-2 mb-3 flex items-center gap-2">
        <MapPin size={14} className="text-ink-3" />
        Venue
      </h3>

      <div className="rounded-xl border border-line overflow-hidden bg-paper-2">
        <div className="relative w-full h-56 md:h-64">
          <iframe
            title={`Map showing ${venue}`}
            width="100%"
            height="100%"
            frameBorder={0}
            scrolling="no"
            marginHeight={0}
            marginWidth={0}
            src={embedUrl}
            className="absolute inset-0"
            allowFullScreen
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>

        <div className="px-4 py-3 border-t border-line flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-medium text-ink truncate">{venue}</p>
            {locationStr && (
              <p className="text-[13px] text-ink-3 truncate">{locationStr}</p>
            )}
          </div>
          <a
            href={linkUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 text-[12px] font-medium text-blue hover:text-blue/80 transition-colors whitespace-nowrap"
          >
            Open in Maps &rarr;
          </a>
        </div>
      </div>
    </section>
  )
}
