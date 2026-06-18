import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/db"
import { users } from "@/db/schema"
import { auth } from "@/auth"
import { sendAdminInviteEmail } from "@/lib/email"

// Invite flow: create the user row with the chosen role (passwordHash null,
// emailVerified null), then send a branded invite email pointing at /auth/signin.
// The invitee requests a magic link (or signs in with Google) using the same
// address and the role is already attached to their account.
const InviteSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  role: z.enum(["attendee", "organizer", "vendor", "transport_operator", "dispatcher", "driver", "conductor"]),
})

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const parsed = InviteSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", issues: parsed.error.issues },
      { status: 400 },
    )
  }
  const { email, role } = parsed.data

  const inserted = await db
    .insert(users)
    .values({ email, role })
    .onConflictDoNothing({ target: users.email })
    .returning({ id: users.id })

  if (inserted.length === 0) {
    return NextResponse.json(
      { error: "A user with this email already exists." },
      { status: 409 },
    )
  }

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? "https://ticketpulse.tech"
  const inviteUrl = `${appUrl}/auth/signin?email=${encodeURIComponent(email)}`

  await sendAdminInviteEmail({
    to: email,
    role,
    inviteUrl,
    inviterName: session.user.name ?? null,
  })

  return NextResponse.json({ ok: true, email, role }, { status: 200 })
}
