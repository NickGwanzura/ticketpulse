import { NextResponse } from "next/server"
import { eq, and, asc } from "drizzle-orm"
import { db } from "@/db"
import { events, ticketQuestions } from "@/db/schema"

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const eventSlug = searchParams.get("eventSlug")

  if (!eventSlug) {
    return NextResponse.json({ error: "Missing eventSlug" }, { status: 400 })
  }

  const [event] = await db
    .select({ id: events.id })
    .from(events)
    .where(eq(events.slug, eventSlug))
    .limit(1)

  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 })
  }

  const questions = await db
    .select({
      id: ticketQuestions.id,
      question: ticketQuestions.question,
      required: ticketQuestions.required,
      sortOrder: ticketQuestions.sortOrder,
    })
    .from(ticketQuestions)
    .where(and(eq(ticketQuestions.eventId, event.id)))
    .orderBy(asc(ticketQuestions.sortOrder))

  return NextResponse.json({ questions })
}
