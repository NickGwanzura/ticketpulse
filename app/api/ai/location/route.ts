import { NextResponse } from "next/server"
import { suggestLocation } from "@/lib/groq"
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
      venue: string
      city: string
    }

    if (!body.venue || !body.city) {
      return NextResponse.json(
        { error: "venue and city are required" },
        { status: 400 },
      )
    }

    const result = await suggestLocation(body.venue, body.city)

    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to suggest location"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
