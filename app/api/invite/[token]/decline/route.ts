import { NextResponse } from "next/server"
import { eq } from "drizzle-orm"

import { db } from "@/db"
import { organiserInvites } from "@/db/schema"

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params

  const [invite] = await db
    .select({ id: organiserInvites.id })
    .from(organiserInvites)
    .where(eq(organiserInvites.token, token))
    .limit(1)

  if (!invite) {
    return NextResponse.json({ error: "Invitation not found" }, { status: 404 })
  }

  await db
    .update(organiserInvites)
    .set({ status: "declined" })
    .where(eq(organiserInvites.id, invite.id))

  return NextResponse.json({ ok: true })
}
