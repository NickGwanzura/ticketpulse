import { NextResponse } from "next/server"
import { eq, and, sql } from "drizzle-orm"

import { auth } from "@/auth"
import { db } from "@/db"
import { organiserInvites, eventOrganisers, events } from "@/db/schema"

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params

  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const [invite] = await db
    .select({
      id: organiserInvites.id,
      eventId: organiserInvites.eventId,
      email: organiserInvites.email,
      invitedBy: organiserInvites.invitedBy,
      status: organiserInvites.status,
      expiresAt: organiserInvites.expiresAt,
      eventTitle: events.title,
    })
    .from(organiserInvites)
    .leftJoin(events, eq(events.id, organiserInvites.eventId))
    .where(eq(organiserInvites.token, token))
    .limit(1)

  if (!invite) {
    return NextResponse.json({ error: "Invitation not found" }, { status: 404 })
  }

  // Verify email matches
  if (session.user.email?.toLowerCase() !== invite.email.toLowerCase()) {
    return NextResponse.json(
      { error: "This invitation was sent to a different email address." },
      { status: 403 },
    )
  }

  // Check expiry
  if (new Date() > invite.expiresAt) {
    return NextResponse.json({ error: "Invitation has expired." }, { status: 410 })
  }

  // Check status
  if (invite.status !== "pending") {
    return NextResponse.json(
      { error: `Invitation is already ${invite.status}.` },
      { status: 409 },
    )
  }

  // Check max organisers limit
  const [countResult] = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(eventOrganisers)
    .where(eq(eventOrganisers.eventId, invite.eventId))

  const count = countResult?.count ?? 0
  if (count >= 2) {
    return NextResponse.json(
      { error: "This event already has the maximum number of organisers." },
      { status: 409 },
    )
  }

  // Check if they're already an organiser
  const [existing] = await db
    .select({ id: eventOrganisers.id })
    .from(eventOrganisers)
    .where(
      and(
        eq(eventOrganisers.eventId, invite.eventId),
        eq(eventOrganisers.userId, session.user.id),
      ),
    )
    .limit(1)

  if (existing) {
    return NextResponse.json(
      { error: "You are already an organiser for this event." },
      { status: 409 },
    )
  }

  // Accept the invite: create event_organisers record and update invite status
  await db.insert(eventOrganisers).values({
    eventId: invite.eventId,
    userId: session.user.id,
    invitedBy: invite.invitedBy,
  })

  await db
    .update(organiserInvites)
    .set({ status: "accepted", acceptedAt: new Date() })
    .where(eq(organiserInvites.id, invite.id))

  return NextResponse.json({ ok: true, redirectTo: `/organizer/events/${invite.eventId}/edit` })
}
