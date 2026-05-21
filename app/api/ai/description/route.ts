import { NextResponse } from "next/server"
import { generateEventDescription } from "@/lib/groq"

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      title: string
      category: string
      venue: string
      city: string
      tags?: string
    }

    if (!body.title || !body.category || !body.venue || !body.city) {
      return NextResponse.json(
        { error: "title, category, venue, and city are required" },
        { status: 400 },
      )
    }

    const description = await generateEventDescription(
      body.title,
      body.category,
      body.venue,
      body.city,
      body.tags,
    )

    return NextResponse.json({ description })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to generate description"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
