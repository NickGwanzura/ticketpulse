"use client"

import { MapPin, ExternalLink, Navigation } from "lucide-react"

interface VenueMapProps {
  lat?: number | string | null
  lng?: number | string | null
  venue: string
  address?: string | null
  city?: string | null
  country?: string | null
  googleMapsUrl?: string | null
}

function hasValidCoords(lat: unknown, lng: unknown): lat is number | string {
  if (lat == null || lng == null) return false
  const n1 = typeof lat === "string" ? parseFloat(lat) : (lat as number)
  const n2 = typeof lng === "string" ? parseFloat(lng) : (lng as number)
  if (isNaN(n1) || isNaN(n2)) return false
  // Reject 0,0 — it's almost always a placeholder/default, not a real location
  if (n1 === 0 && n2 === 0) return false
  return true
}

/**
 * Interactive venue map using an OpenStreetMap embed iframe.
 * Falls back to a venue-address card with Google Maps link when coordinates are missing.
 */
export default function VenueMap({ lat, lng, venue, address, city, country, googleMapsUrl }: VenueMapProps) {
  const fullAddress = [venue, address, city, country].filter(Boolean).join(", ")
  const hasCoords = hasValidCoords(lat, lng)

  const latNum = hasCoords
    ? (typeof lat === "string" ? parseFloat(lat) : (lat as number))
    : 0
  const lngNum = hasCoords
    ? (typeof lng === "string" ? parseFloat(lng) : (lng as number))
    : 0

  // Build links (use googleMapsUrl if provided, otherwise auto-generate)
  const googleMapsLink =
    googleMapsUrl ||
    (hasCoords ? `https://www.google.com/maps?q=${latNum},${lngNum}` : null)
  const googleDirectionsLink = hasCoords
    ? `https://www.google.com/maps/dir/?api=1&destination=${latNum},${lngNum}`
    : null

  const osmLink = hasCoords
    ? `https://www.openstreetmap.org/?mlat=${latNum}&mlng=${lngNum}#map=15/${latNum}/${lngNum}`
    : null

  // Embed iframe URL — prefer OSM with coords, fall back to Google Maps search embed
  const padding = 0.02
  const bbox = hasCoords
    ? `${lngNum - padding},${latNum - padding},${lngNum + padding},${latNum + padding}`
    : null
  const osmEmbedUrl = bbox
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${latNum},${lngNum}`
    : null

  // Google Maps search embed — works without an API key using the address
  const searchQuery = [venue, address, city, country].filter(Boolean).join(", ")
  const googleSearchEmbedUrl = searchQuery
    ? `https://maps.google.com/maps?q=${encodeURIComponent(searchQuery)}&output=embed&z=15`
    : null

  const embedUrl = osmEmbedUrl ?? googleSearchEmbedUrl

  return (
    <section>
      <h3 className="text-[13px] font-semibold text-ink-2 mb-3 flex items-center gap-2">
        <MapPin size={14} className="text-ink-3" />
        Venue location
      </h3>

      <div className="rounded-xl border border-line overflow-hidden bg-paper shadow-sm">
        {/* Map embed — only when coordinates are available */}
        {embedUrl ? (
          <div className="relative w-full h-56 md:h-72">
            <iframe
              title={`Map showing ${venue}`}
              src={embedUrl}
              className="absolute inset-0 w-full h-full"
              style={{ border: "none" }}
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              sandbox="allow-scripts allow-same-origin allow-popups"
            />
          </div>
        ) : (
          /* Fallback banner when no coordinates */
          <div className="relative w-full h-40 md:h-48 bg-gradient-to-br from-sky-50 via-blue-50 to-cyan-50 flex items-center justify-center">
            <div className="text-center px-6">
              <MapPin size={32} className="mx-auto mb-2 text-sky-300" />
              <p className="text-sm font-medium text-ink-2">{venue}</p>
              {fullAddress && <p className="text-[12px] text-ink-3 mt-0.5">{fullAddress}</p>}
            </div>
          </div>
        )}

        <div className="px-4 py-3.5 border-t border-line space-y-1">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-ink">{venue}</p>
            {fullAddress && (
              <p className="text-[12.5px] text-ink-3 mt-0.5 leading-snug">{fullAddress}</p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            {googleMapsLink && (
              <a
                href={googleMapsLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-brand-600 hover:text-green-700 transition-colors tracking-tight rounded-lg border border-green-500/20 bg-green-50/40 px-2.5 py-1.5"
              >
                <MapPin size={12} />
                Open in Google Maps
              </a>
            )}
            {googleDirectionsLink && (
              <a
                href={googleDirectionsLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-brand-600 hover:text-green-700 transition-colors tracking-tight rounded-lg border border-brand-200 bg-green-50 px-2.5 py-1.5"
              >
                <Navigation size={12} />
                Get Directions
              </a>
            )}
            {osmLink && (
              <a
                href={osmLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-[11px] font-medium text-ink-3 hover:text-ink transition-colors tracking-tight"
              >
                <ExternalLink size={11} />
                OpenStreetMap
              </a>
            )}
          </div>

          {hasCoords && (
            <p className="text-[10px] text-ink-3/60 tracking-tight">
              {latNum.toFixed(5)}, {lngNum.toFixed(5)}
            </p>
          )}
        </div>
      </div>
    </section>
  )
}
