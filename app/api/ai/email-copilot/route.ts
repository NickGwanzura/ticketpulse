import { NextResponse } from "next/server"
import { generateEmailContent } from "@/lib/groq"

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      eventTitle: string
      eventDate: string
      purpose: "reminder" | "thank_you" | "announcement" | "update" | "custom"
      customInstructions?: string
    }

    if (!body.eventTitle || !body.eventDate || !body.purpose) {
      return NextResponse.json(
        { error: "eventTitle, eventDate, and purpose are required" },
        { status: 400 },
      )
    }

    const result = await generateEmailContent(
      body.eventTitle,
      body.eventDate,
      body.purpose,
      body.customInstructions,
    )
    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to generate email"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
