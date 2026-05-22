import { NextResponse } from "next/server"
import { generatePlatformBrief } from "@/lib/groq"

export async function POST(request: Request) {
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
