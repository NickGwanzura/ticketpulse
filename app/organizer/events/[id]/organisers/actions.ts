"use server"

import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { eq, and, sql } from "drizzle-orm"
import { z } from "zod"

import { auth } from "@/auth"
import { db } from "@/db"
import { events, users, eventOrganisers, organiserInvites } from "@/db/schema"
import { organiserInviteEmail } from "@/lib/email-templates"
import { sendEmail } from "@/lib/email"

const MAX_INVITED_ORGANISERS = 2
const INVITE_EXPIRY_HOURS = 72

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://ticketplse.tech"

async function requireOwnerAccess(eventId: string) {
  const session = await auth()
  if (!session?.user?.id) {
    return { ok: false as const, redirectTo: "/auth/signin" }
  }
  const [row] = await db
    .select({ id: events.id, organizerId: events.organizerId, title: events.title, slug: events.slug })
    .from(events)
    .where(eq(events.id, eventId))
    .limit(1)
  if (!row) return { ok: false as const, redirectTo: "/organizer" }
  if (row.organizerId !== session.user.id && session.user.role !== "admin") {
    return { ok: false as const, redirectTo: "/organizer" }
  }
  return { ok: true as const, session, event: row }
}

export type InviteOrganiserState = {
  ok: boolean
  error?: string
  message?: string
  fieldErrors?: Record<string, string>
}

export async function inviteOrganiserAction(
  _prev: InviteOrganiserState,
  formData: FormData,
): Promise<InviteOrganiserState> {
  const eventId = formData.get("eventId")?.toString()
  const email = formData.get("email")?.toString()?.trim().toLowerCase()

  if (!eventId || !email) {
    return { ok: false, error: "Missing required fields.", fieldErrors: { email: "Email is required" } }
  }

  const emailSchema = z.string().email("Invalid email address")
  const parsedEmail = emailSchema.safeParse(email)
  if (!parsedEmail.success) {
    return { ok: false, error: "Please enter a valid email address.", fieldErrors: { email: "Invalid email" } }
  }

  const guard = await requireOwnerAccess(eventId)
  if (!guard.ok) return { ok: false, error: "Not allowed." }

  // Count current active invited organisers (accepted)
  const [countResult] = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(eventOrganisers)
    .where(eq(eventOrganisers.eventId, eventId))

  const activeCount = Number(countResult?.count ?? 0)
  if (activeCount >= MAX_INVITED_ORGANISERS) {
    return {
      ok: false,
      error: `Maximum of ${MAX_INVITED_ORGANISERS} invited organisers reached. Remove an existing one first.`,
    }
  }

  // Check the invited user isn't already an organiser
  const [existingUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1)

  if (existingUser) {
    const [already] = await db
      .select({ id: eventOrganisers.id })
      .from(eventOrganisers)
      .where(
        and(
          eq(eventOrganisers.eventId, eventId),
          eq(eventOrganisers.userId, existingUser.id),
        ),
      )
      .limit(1)
    if (already) {
      return { ok: false, error: "This person is already an organiser for this event." }
    }
  }

  // Check if there's already a pending invite for this email
  const [existingInvite] = await db
    .select({ id: organiserInvites.id, status: organiserInvites.status })
    .from(organiserInvites)
    .where(
      and(
        eq(organiserInvites.eventId, eventId),
        eq(organiserInvites.email, email),
      ),
    )
    .limit(1)

  if (existingInvite && existingInvite.status === "pending") {
    return { ok: false, error: "An invitation has already been sent to this email. It is pending acceptance." }
  }

  // If there was a declined/expired invite, delete it so we can resend
  if (existingInvite) {
    await db.delete(organiserInvites).where(eq(organiserInvites.id, existingInvite.id))
  }

  // Create invite
  const token = crypto.randomUUID()
  const expiresAt = new Date(Date.now() + INVITE_EXPIRY_HOURS * 60 * 60 * 1000)

  await db.insert(organiserInvites).values({
    eventId,
    invitedBy: guard.session.user.id,
    email,
    token,
    expiresAt,
  })

  // Send the invitation email
  const inviteUrl = `${APP_URL}/invite/${token}`
  const inviterName = guard.session.user.name ?? "An organiser"
  const { html, text } = organiserInviteEmail({
    inviterName,
    eventTitle: guard.event.title,
    inviteUrl,
    email,
    expiresInHours: INVITE_EXPIRY_HOURS,
  })

  await sendEmail({ to: email, subject: `You are invited to organise ${guard.event.title}`, html, text })

  revalidatePath(`/organizer/events/${eventId}/organisers`)
  return { ok: true, message: `Invitation sent to ${email}. They have ${INVITE_EXPIRY_HOURS}h to accept.` }
}

export async function removeOrganiserAction(formData: FormData): Promise<void> {
  const eventId = formData.get("eventId")?.toString()
  const organiserId = formData.get("organiserId")?.toString()
  if (!eventId || !organiserId) return

  const guard = await requireOwnerAccess(eventId)
  if (!guard.ok) redirect(guard.redirectTo)

  await db
    .delete(eventOrganisers)
    .where(
      and(
        eq(eventOrganisers.id, organiserId),
        eq(eventOrganisers.eventId, eventId),
      ),
    )

  revalidatePath(`/organizer/events/${eventId}/organisers`)
}

export async function cancelInviteAction(formData: FormData): Promise<void> {
  const eventId = formData.get("eventId")?.toString()
  const inviteId = formData.get("inviteId")?.toString()
  if (!eventId || !inviteId) return

  const guard = await requireOwnerAccess(eventId)
  if (!guard.ok) redirect(guard.redirectTo)

  await db
    .delete(organiserInvites)
    .where(
      and(
        eq(organiserInvites.id, inviteId),
        eq(organiserInvites.eventId, eventId),
      ),
    )

  revalidatePath(`/organizer/events/${eventId}/organisers`)
}
