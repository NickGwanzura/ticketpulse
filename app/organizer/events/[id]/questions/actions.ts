"use server"

import { eq, and } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { z } from "zod"

import { db } from "@/db"
import { ticketQuestions, events } from "@/db/schema"
import { requireEventAccess } from "@/lib/event-access"

const QuestionSchema = z.object({
  id: z.string().uuid().optional(),
  question: z.string().min(1).max(500),
  required: z.boolean().default(false),
  scope: z.enum(["order", "attendee"]).default("order"),
  sortOrder: z.number().int().min(0).max(3),
})

export async function saveEventQuestions(
  eventId: string,
  questions: z.infer<typeof QuestionSchema>[],
) {
  const access = await requireEventAccess(eventId)
  if (!access.allowed) throw new Error("Unauthorized")

  const parsed = z.array(QuestionSchema).min(0).max(4).parse(questions)

  // Verify event exists
  const [event] = await db.select({ id: events.id }).from(events).where(eq(events.id, eventId)).limit(1)
  if (!event) throw new Error("Event not found")

  // Get existing questions
  const existing = await db
    .select({ id: ticketQuestions.id })
    .from(ticketQuestions)
    .where(eq(ticketQuestions.eventId, eventId))

  const existingIds = new Set(existing.map((e) => e.id))
  const incomingIds = new Set(parsed.filter((q) => q.id).map((q) => q.id!))

  await db.transaction(async (tx) => {
    // Delete removed questions
    for (const id of existingIds) {
      if (!incomingIds.has(id)) {
        await tx.delete(ticketQuestions).where(eq(ticketQuestions.id, id))
      }
    }

    // Upsert questions
    for (const q of parsed) {
      if (q.id && existingIds.has(q.id)) {
        await tx
          .update(ticketQuestions)
          .set({
            question: q.question,
            required: q.required,
            scope: q.scope,
            sortOrder: q.sortOrder,
          })
          .where(eq(ticketQuestions.id, q.id))
      } else {
        await tx.insert(ticketQuestions).values({
          eventId,
          question: q.question,
          required: q.required,
          scope: q.scope,
          sortOrder: q.sortOrder,
        })
      }
    }
  })

  revalidatePath(`/organizer/events/${eventId}/questions`)
  return { success: true }
}
