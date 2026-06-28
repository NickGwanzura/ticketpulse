import { NextResponse } from "next/server"
import { generatePlatformBrief } from "@/lib/groq"
import { rateLimit } from "@/lib/rate-limit"

const aiLimiter = rateLimit({ windowMs: 60_000, max: 10 })

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
      activeEvents: number
      totalOrganizers: number
      totalRevenue: number
      topCategory: string
      topCity: string
    }

    const result = await generatePlatformBrief(
      body.activeEvents,
      body.totalOrganizers,
      body.totalRevenue,
      body.topCategory,
      body.topCity,
    )
    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to generate brief"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
