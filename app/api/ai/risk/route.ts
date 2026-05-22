import { NextResponse } from "next/server"
import { assessOrganizerRisk } from "@/lib/groq"

export async function POST(request: Request) {
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
