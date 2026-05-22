import { NextResponse } from "next/server"
import { generateNarrativeSummary } from "@/lib/groq"

export async function POST(request: Request) {
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
