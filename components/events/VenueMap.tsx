"use client"

import { MapPin, ExternalLink, Navigation } from "lucide-react"

interface VenueMapProps {
  lat: number | string
  lng: number | string
  venue: string
  address?: string | null
  city?: string | null
  country?: string | null
  googleMapsUrl?: string | null
}

/**
 * Interactive venue map using an OpenStreetMap embed iframe.
 * Also provides Google Maps and OpenStreetMap links for directions.
 */
export default function VenueMap({ lat, lng, venue, address, city, country, googleMapsUrl }: VenueMapProps) {
  const latNum = typeof lat === "string" ? parseFloat(lat) : lat
  const lngNum = typeof lng === "string" ? parseFloat(lng) : lng

  if (isNaN(latNum) || isNaN(lngNum)) return null

  // Build a bounding box ~0.02° around the point (roughly 2 km)
  const padding = 0.02
  const bbox = `${lngNum - padding},${latNum - padding},${lngNum + padding},${latNum + padding}`

  const embedUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${latNum},${lngNum}`
  const osmLink = `https://www.openstreetmap.org/?mlat=${latNum}&mlng=${lngNum}#map=15/${latNum}/${lngNum}`
  const googleMapsLink = googleMapsUrl || `https://www.google.com/maps?q=${latNum},${lngNum}`
  const googleDirectionsLink = `https://www.google.com/maps/dir/?api=1&destination=${latNum},${lngNum}`

  const fullAddress = [venue, address, city, country].filter(Boolean).join(", ")

  return (
    <section>
      <h3 className="text-[13px] font-semibold text-ink-2 mb-3 flex items-center gap-2">
        <MapPin size={14} className="text-ink-3" />
        Venue location
      </h3>

      <div className="rounded-xl border border-line overflow-hidden bg-paper shadow-sm">
        <div className="relative w-full h-56 md:h-72">
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

        <div className="px-4 py-3.5 border-t border-line space-y-1">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-ink">{venue}</p>
            {fullAddress && (
              <p className="text-[12.5px] text-ink-3 mt-0.5 leading-snug">{fullAddress}</p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <a
              href={googleMapsLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-blue hover:text-blue/80 transition-colors tracking-tight rounded-lg border border-blue/20 bg-blue-soft/40 px-2.5 py-1.5"
            >
              <MapPin size={12} />
              Open in Google Maps
            </a>
            <a
              href={googleDirectionsLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-600 hover:text-emerald-700 transition-colors tracking-tight rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5"
            >
              <Navigation size={12} />
              Get Directions
            </a>
            <a
              href={osmLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-[11px] font-medium text-ink-3 hover:text-ink transition-colors tracking-tight"
            >
              <ExternalLink size={11} />
              OpenStreetMap
            </a>
          </div>

          <p className="text-[10px] text-ink-3/60 tracking-tight">
            {latNum.toFixed(5)}, {lngNum.toFixed(5)}
          </p>
        </div>
      </div>
    </section>
  )
}
