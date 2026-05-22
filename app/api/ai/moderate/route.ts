import { NextResponse } from "next/server"
import { moderateEventContent } from "@/lib/groq"

export async function POST(request: Request) {
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

    const result = await moderateEventContent(body.title, body.description, body.category)
    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to moderate content"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
