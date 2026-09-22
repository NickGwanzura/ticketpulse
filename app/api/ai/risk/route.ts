import { NextResponse } from "next/server"
import { assessOrganizerRisk } from "@/lib/groq"
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
      organizerName: string
      email: string
      eventCount: number
      firstEventTitle?: string
    }

    if (!body.organizerName || !body.email) {
      return NextResponse.json(
        { error: "organizerName and email are required" },
        { status: 400 },
      )
    }

    const result = await assessOrganizerRisk(
      body.organizerName,
      body.email,
      body.eventCount,
      body.firstEventTitle,
    )
    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to assess risk"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
