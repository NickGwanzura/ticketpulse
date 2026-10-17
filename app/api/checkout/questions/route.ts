import { NextResponse } from "next/server"
import { eq, and, asc } from "drizzle-orm"
import { z } from "zod"
import { db } from "@/db"
import { events, ticketQuestions } from "@/db/schema"
import { apiLimiter } from "@/lib/rate-limit"

export async function GET(req: Request) {
  const limited = await apiLimiter.checkRequest(req)
  if (!limited.allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(Math.ceil(limited.retryAfterMs / 1000)) } },
    )
  }

  const { searchParams } = new URL(req.url)
  const parsed = z.string().trim().min(1).max(160).safeParse(searchParams.get("eventSlug"))

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid eventSlug" }, { status: 400 })
  }

  const [event] = await db
    .select({ id: events.id })
    .from(events)
    .where(and(eq(events.slug, parsed.data), eq(events.status, "published")))
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
