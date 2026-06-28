import { NextRequest, NextResponse } from "next/server"
import { generateAnnouncementContent } from "@/lib/groq"
import { rateLimit } from "@/lib/rate-limit"

const aiLimiter = rateLimit({ windowMs: 60_000, max: 10 })

export async function POST(req: NextRequest) {
  const rl = aiLimiter.checkRequest(req)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } },
    )
  }

  try {
    const { topic, audience, tone } = await req.json()

    if (!topic || !audience || !tone) {
      return NextResponse.json(
        { error: "topic, audience, and tone are required" },
        { status: 400 },
      )
    }

    if (!["attendees", "organizers", "all_users"].includes(audience)) {
      return NextResponse.json(
        { error: 'audience must be "attendees", "organizers", or "all_users"' },
        { status: 400 },
      )
    }

    if (!["friendly", "professional", "urgent"].includes(tone)) {
      return NextResponse.json(
        { error: 'tone must be "friendly", "professional", or "urgent"' },
        { status: 400 },
      )
    }

    const result = await generateAnnouncementContent(topic, audience as any, tone as any)

    return NextResponse.json(result)
  } catch (err) {
    console.error("[ai/announcement] error:", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to generate announcement" },
      { status: 500 },
    )
  }
}
