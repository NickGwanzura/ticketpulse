import { auth } from "@/auth"
import { redirect, notFound } from "next/navigation"
import { eq, asc } from "drizzle-orm"

import { db } from "@/db"
import { events, ticketQuestions } from "@/db/schema"
import { requireEventAccess } from "@/lib/event-access"
import PageHeader from "@/components/dashboard/PageHeader"
import QuestionsForm from "./QuestionsForm"

export const metadata = { title: "Ticket Questions" }

type RouteParams = { id: string }

export default async function QuestionsPage({ params }: { params: Promise<RouteParams> }) {
  const { id } = await params

  const session = await auth()
  if (!session) redirect(`/auth/signin?callbackUrl=/organizer/events/${id}/questions`)

  const access = await requireEventAccess(id)
  if (!access.allowed) redirect("/organizer")

  const [event] = await db
    .select({ id: events.id, title: events.title })
    .from(events)
    .where(eq(events.id, id))
    .limit(1)
  if (!event) notFound()

  const questionRows = await db
    .select({
      id: ticketQuestions.id,
      question: ticketQuestions.question,
      required: ticketQuestions.required,
      scope: ticketQuestions.scope,
      sortOrder: ticketQuestions.sortOrder,
    })
    .from(ticketQuestions)
    .where(eq(ticketQuestions.eventId, id))
    .orderBy(asc(ticketQuestions.sortOrder))

  const questions = questionRows.map((q) => ({
    id: q.id,
    question: q.question,
    required: q.required ?? false,
    scope: (q.scope ?? "order") as "order" | "attendee",
    sortOrder: q.sortOrder ?? 0,
  }))

  return (
    <div className="tp-fade-up">
      <PageHeader
        eyebrow="Organizer"
        title={`Questions: ${event.title}`}
      />

      <div className="max-w-3xl mx-auto px-5 md:px-8 py-8 md:py-10">
        <QuestionsForm eventId={id} initialQuestions={questions} />
      </div>
    </div>
  )
}
