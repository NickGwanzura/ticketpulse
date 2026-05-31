import { NextResponse } from "next/server"
import { geocodeFromLocation } from "@/lib/geocode"

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const venue   = searchParams.get("venue")   ?? ""
  const city    = searchParams.get("city")    ?? ""
  const country = searchParams.get("country") ?? ""
  const address = searchParams.get("address") ?? ""

  if (!venue || !city) {
    return NextResponse.json({ lat: null, lng: null })
  }

  const result = await geocodeFromLocation(venue, city, country, address)
  return NextResponse.json(result, {
    headers: { "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800" },
  })
}
