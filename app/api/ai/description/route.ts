import { NextResponse } from "next/server"
import { generateEventDescription } from "@/lib/groq"
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
      title: string
      category: string
      venue: string
      city: string
      tags?: string
    }

    if (!body.title || !body.category || !body.venue || !body.city) {
      return NextResponse.json(
        { error: "title, category, venue, and city are required" },
        { status: 400 },
      )
    }

    const description = await generateEventDescription(
      body.title,
      body.category,
      body.venue,
      body.city,
      body.tags,
    )

    return NextResponse.json({ description })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to generate description"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
