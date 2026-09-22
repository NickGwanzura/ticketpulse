import { NextResponse } from "next/server"
import { generateSocialBlurb } from "@/lib/groq"
import { rateLimit } from "@/lib/rate-limit"

const aiLimiter = rateLimit({ windowMs: 60_000, max: 20 })

export async function POST(request: Request) {
  const rl = await aiLimiter.checkRequest(request)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } },
    )
  }

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
