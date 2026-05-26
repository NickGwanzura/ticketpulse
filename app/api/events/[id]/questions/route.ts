import { NextResponse } from "next/server"
import { eq, and, asc } from "drizzle-orm"
import { db } from "@/db"
import { events, ticketQuestions } from "@/db/schema"

type Params = { id: string }

export async function GET(_req: Request, ctx: { params: Promise<Params> }) {
  const { id } = await ctx.params

  const [event] = await db
    .select({ id: events.id })
    .from(events)
    .where(eq(events.id, id))
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
    .where(and(eq(ticketQuestions.eventId, id)))
    .orderBy(asc(ticketQuestions.sortOrder))

  return NextResponse.json({ questions })
}
