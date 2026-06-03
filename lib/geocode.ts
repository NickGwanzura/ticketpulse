import "server-only"

/**
 * Geocode an address to lat/lng using OpenStreetMap Nominatim.
 * Free and does not require an API key for reasonable usage.
 * Must run server-side so the correct User-Agent is sent to Nominatim.
 */

export interface GeocodeResult {
  lat: number | null
  lng: number | null
}

/**
 * Build a full address string from event location fields and geocode it.
 * Returns `{ lat: null, lng: null }` silently if geocoding fails or
 * the address is too short to be meaningful.
 */
export async function geocodeFromLocation(
  venue: string,
  city: string,
  country: string,
  address?: string | null,
): Promise<GeocodeResult> {
  const parts = [venue, address, city, country].filter(Boolean)
  const query = parts.join(", ")

  // Minimum viable address
  if (!venue || !city || query.length < 6) {
    return { lat: null, lng: null }
  }

  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`
    const res = await fetch(url, {
      headers: {
        // Nominatim requires a descriptive User-Agent
        "User-Agent": "TicketPulse/1.0 (event management app; https://ticketpulse.tech)",
      },
      signal: AbortSignal.timeout(5_000),
    })

    if (!res.ok) return { lat: null, lng: null }

    const data: Array<{ lat: string; lon: string }> | null = await res.json().catch(() => null)
    if (!data || data.length === 0) return { lat: null, lng: null }

    return {
      lat: parseFloat(data[0].lat),
      lng: parseFloat(data[0].lon),
    }
  } catch {
    // Network errors, timeouts, etc. — fail silently
    return { lat: null, lng: null }
  }
}
