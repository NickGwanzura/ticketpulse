import { NextResponse } from "next/server"
import { generateSocialBlurb } from "@/lib/groq"

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      eventTitle: string
      category: string
      eventDate: string
      venue: string
      city: string
      platform: "twitter" | "facebook" | "instagram"
    }

    if (!body.eventTitle || !body.eventDate || !body.venue || !body.city) {
      return NextResponse.json(
        { error: "eventTitle, eventDate, venue, and city are required" },
        { status: 400 },
      )
    }

    const blurb = await generateSocialBlurb(
      body.eventTitle,
      body.category,
      body.eventDate,
      body.venue,
      body.city,
      body.platform,
    )
    return NextResponse.json({ blurb })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to generate social blurb"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
