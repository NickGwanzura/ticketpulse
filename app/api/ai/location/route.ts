import { NextResponse } from "next/server"
import { suggestLocation } from "@/lib/groq"

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      venue: string
      city: string
    }

    if (!body.venue || !body.city) {
      return NextResponse.json(
        { error: "venue and city are required" },
        { status: 400 },
      )
    }

    const result = await suggestLocation(body.venue, body.city)

    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to suggest location"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
