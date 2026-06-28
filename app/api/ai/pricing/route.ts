import { NextResponse } from "next/server"
import { suggestPricing } from "@/lib/groq"
import { rateLimit } from "@/lib/rate-limit"

const aiLimiter = rateLimit({ windowMs: 60_000, max: 20 })

export async function POST(request: Request) {
  const rl = aiLimiter.checkRequest(request)
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
      venue: string
      city: string
    }

    if (!body.eventTitle || !body.category || !body.venue || !body.city) {
      return NextResponse.json(
        { error: "eventTitle, category, venue, and city are required" },
        { status: 400 },
      )
    }

    const result = await suggestPricing(
      body.eventTitle,
      body.category,
      body.venue,
      body.city,
    )
    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to suggest pricing"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
