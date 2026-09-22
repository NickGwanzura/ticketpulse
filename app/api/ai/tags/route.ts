import { NextResponse } from "next/server"
import { suggestTags } from "@/lib/groq"
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
      description: string
      category: string
    }

    if (!body.title || !body.category) {
      return NextResponse.json(
        { error: "title and category are required" },
        { status: 400 },
      )
    }

    const tags = await suggestTags(body.title, body.description, body.category)
    return NextResponse.json({ tags })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to suggest tags"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
