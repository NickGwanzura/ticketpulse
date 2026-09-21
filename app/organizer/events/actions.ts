"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { eq, sql } from "drizzle-orm"

import { db } from "@/db"
import { events, orders, paymentLedger, tickets, ticketTiers, users } from "@/db/schema"
import { requireOwnerAccess } from "@/lib/event-access"
import { sendEmail, adminEmail } from "@/lib/email"
import { eventSubmittedForReviewAdminEmail, eventSubmittedForReviewOrganizerEmail } from "@/lib/email-templates"
import { log } from "@/lib/logger"
import { isFutureEventStart } from "@/lib/event-schedule"

export async function publishOrganizerEventAction(eventId: string) {
  const access = await requireOwnerAccess(eventId)
  if (!access.ok) redirect(access.redirectTo)

  const [event] = await db
    .select({
      id: events.id,
      title: events.title,
      status: events.status,
      organizerId: events.organizerId,
      startsAt: events.startsAt,
    })
    .from(events)
    .where(eq(events.id, eventId))
    .limit(1)

  if (!event) redirect("/organizer")
  if (event.status === "published") redirect(`/organizer/events/${eventId}?published=already`)
  if (event.status === "pending_review") redirect(`/organizer/events/${eventId}?published=pending`)
  if (event.status === "cancelled" || event.status === "completed") {
    redirect(`/organizer/events/${eventId}?publishError=locked`)
  }
  if (!isFutureEventStart(event.startsAt)) {
    redirect(`/organizer/events/${eventId}?publishError=past_start`)
  }

  const [tierCount] = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(ticketTiers)
    .where(eq(ticketTiers.eventId, eventId))

  if ((tierCount?.count ?? 0) < 1) {
    redirect(`/organizer/events/${eventId}/tiers?error=missing_tiers`)
  }

  await db
    .update(events)
    .set({ status: "pending_review", updatedAt: new Date() })
    .where(eq(events.id, eventId))

  revalidatePath("/organizer")
  revalidatePath("/admin/events")
  revalidatePath(`/organizer/events/${eventId}`)
  revalidatePath(`/organizer/events/${eventId}/edit`)
  revalidatePath(`/organizer/events/${eventId}/tiers`)

  const [organizer] = await db
    .select({ name: users.name, email: users.email })
    .from(users)
    .where(eq(users.id, event.organizerId))
    .limit(1)

  try {
    const { html, text } = eventSubmittedForReviewAdminEmail({
      eventTitle: event.title,
      organizerName: organizer?.name,
    })
    await sendEmail({
      to: adminEmail,
      subject: `Event pending review: ${event.title}`,
      html,
      text,
    })
  } catch (err) {
    console.error("[publishOrganizerEvent] failed to notify admin:", err)
    log.error("publishOrganizerEvent — failed to notify admin", { eventId, error: String(err) })
  }

  try {
    if (organizer?.email) {
      const { html, text } = eventSubmittedForReviewOrganizerEmail({
        eventTitle: event.title,
        organizerName: organizer.name,
      })
      await sendEmail({
        to: organizer.email,
        subject: `${event.title} is under review`,
        html,
        text,
      })
    }
  } catch (err) {
    console.error("[publishOrganizerEvent] failed to notify organiser:", err)
    log.error("publishOrganizerEvent — failed to notify organiser", { eventId, error: String(err) })
  }

  redirect(`/organizer/events/${eventId}?published=pending`)
}

export async function deleteOrganizerEventAction(formData: FormData): Promise<void> {
  const eventId = formData.get("id")?.toString()
  if (!eventId) redirect("/organizer")

  const access = await requireOwnerAccess(eventId)
  if (!access.ok) redirect(access.redirectTo)

  const [[event], [orderRow], [ticketRow], [ledgerRow]] = await Promise.all([
    db
      .select({ id: events.id, slug: events.slug })
      .from(events)
      .where(eq(events.id, eventId))
      .limit(1),
    db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(orders)
      .where(eq(orders.eventId, eventId)),
    db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(tickets)
      .where(eq(tickets.eventId, eventId)),
    db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(paymentLedger)
      .where(eq(paymentLedger.eventId, eventId)),
  ])

  if (!event) redirect("/organizer")

  const hasAccountingActivity =
    Number(orderRow?.count ?? 0) > 0 ||
    Number(ticketRow?.count ?? 0) > 0 ||
    Number(ledgerRow?.count ?? 0) > 0

  if (hasAccountingActivity) {
    redirect(`/organizer/events/${eventId}/edit?deleteError=has_activity`)
  }

  await db
    .delete(events)
    .where(eq(events.id, eventId))

  revalidatePath("/events")
  revalidatePath("/organizer")
  revalidatePath("/admin/events")
  revalidatePath(`/organizer/events/${eventId}`)
  revalidatePath(`/organizer/events/${eventId}/edit`)
  revalidatePath(`/events/${event.slug}`)

  redirect("/organizer?deleted=1")
}
