import { NextResponse } from "next/server"
import { generateSalesInsight } from "@/lib/groq"

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      eventTitle: string
      sold: number
      capacity: number
      daysRemaining: number
      category: string
      city: string
    }

    if (!body.eventTitle) {
      return NextResponse.json(
        { error: "eventTitle is required" },
        { status: 400 },
      )
    }

    const insight = await generateSalesInsight(
      body.eventTitle,
      body.sold,
      body.capacity,
      body.daysRemaining,
      body.category,
      body.city,
    )
    return NextResponse.json({ insight })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to generate insight"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
