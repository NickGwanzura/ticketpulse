import { NextResponse } from "next/server"
import { generateNarrativeSummary } from "@/lib/groq"
import { rateLimit } from "@/lib/rate-limit"

const aiLimiter = rateLimit({ windowMs: 60_000, max: 10 })

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
      totalRevenue: number
      eventCount: number
      organizerCount: number
      topCity: string
      topCategory: string
      paymentMethods: { method: string; pct: number }[]
    }

    const result = await generateNarrativeSummary(
      body.totalRevenue,
      body.eventCount,
      body.organizerCount,
      body.topCity,
      body.topCategory,
      body.paymentMethods,
    )
    return NextResponse.json({ narrative: result })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to generate narrative"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
