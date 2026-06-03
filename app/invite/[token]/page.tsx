import { notFound } from "next/navigation"
import { eq } from "drizzle-orm"

import { auth } from "@/auth"
import { db } from "@/db"
import { organiserInvites, events } from "@/db/schema"
import AcceptInviteForm from "./AcceptInviteForm"

export const metadata = { title: "Accept invitation" }

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params

  const session = await auth()

  const [invite] = await db
    .select({
      id: organiserInvites.id,
      eventId: organiserInvites.eventId,
      email: organiserInvites.email,
      status: organiserInvites.status,
      expiresAt: organiserInvites.expiresAt,
      eventTitle: events.title,
    })
    .from(organiserInvites)
    .leftJoin(events, eq(events.id, organiserInvites.eventId))
    .where(eq(organiserInvites.token, token))
    .limit(1)

  if (!invite) {
    notFound()
  }

  // Check if expired
  if (new Date() > invite.expiresAt) {
    return (
      <div className="min-h-screen grid place-items-center p-6 bg-paper-2">
        <div className="max-w-md w-full text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-rose-100 mx-auto flex items-center justify-center">
            <span className="text-2xl">⏰</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">Invitation expired</h1>
          <p className="text-ink-2">
            This invitation to organise <strong>{invite.eventTitle}</strong> has expired.
            Ask the event organiser to send a new invitation.
          </p>
        </div>
      </div>
    )
  }

  if (invite.status !== "pending") {
    const msg =
      invite.status === "accepted"
        ? "You have already accepted this invitation."
        : "This invitation has been declined or cancelled."

    return (
      <div className="min-h-screen grid place-items-center p-6 bg-paper-2">
        <div className="max-w-md w-full text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-paper mx-auto flex items-center justify-center ring-1 ring-line">
            <span className="text-2xl">{invite.status === "accepted" ? "✅" : "🚫"}</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">
            {invite.status === "accepted" ? "Already accepted" : "Invitation no longer valid"}
          </h1>
          <p className="text-ink-2">{msg}</p>
          {invite.status === "accepted" && (
            <a
              href={`/organizer`}
              className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white shadow-sm shadow-brand-600/20 hover:bg-brand-700 transition"
            >
              Go to dashboard
            </a>
          )}
        </div>
      </div>
    )
  }

  // Check if the user is signed in and their email matches
  const emailMatches = session?.user?.email?.toLowerCase() === invite.email.toLowerCase()

  return (
    <div className="min-h-screen grid place-items-center p-6 bg-paper-2">
      <AcceptInviteForm
        token={token}
        eventTitle={invite.eventTitle ?? "Untitled event"}
        email={invite.email}
        isSignedIn={!!session}
        emailMatches={emailMatches}
      />
    </div>
  )
}
