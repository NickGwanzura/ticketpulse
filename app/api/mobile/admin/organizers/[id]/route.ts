import { NextResponse } from "next/server"
import { eq } from "drizzle-orm"
import { z } from "zod"
import { db } from "@/db"
import { notifications, users } from "@/db/schema"
import { authenticateOrganizer, privateHeaders } from "@/lib/mobile-organizer"
import { defaultNotificationPriority } from "@/lib/notification-priority"

type Context = { params: Promise<{ id: string }> }
const respond = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: privateHeaders })

export async function POST(request: Request, context: Context) {
  const identity = await authenticateOrganizer(request)
  if (!identity.ok) return respond(identity, identity.status)
  if (identity.role !== "admin") return respond({ ok: false, error: "Admin access required" }, 403)
  const { id } = await context.params
  if (!z.string().min(1).safeParse(id).success) return respond({ ok: false, error: "Invalid organizer ID" }, 400)
  const parsed = z.object({ action: z.enum(["approve", "reject"]) }).safeParse(await request.json().catch(() => null))
  if (!parsed.success) return respond({ ok: false, error: "Choose approve or reject." }, 400)
  const [organizer] = await db.select({ id: users.id, name: users.name, approvedAt: users.approvedAt }).from(users).where(eq(users.id, id)).limit(1)
  if (!organizer) return respond({ ok: false, error: "Organizer not found." }, 404)
  const approved = parsed.data.action === "approve"
  await db.update(users).set({ approvedAt: approved ? new Date() : null, updatedAt: new Date() }).where(eq(users.id, id))
  await db.insert(notifications).values({
    userId: id,
    type: "system",
    priority: defaultNotificationPriority("system"),
    title: approved ? "Organizer account approved" : "Organizer approval needs attention",
    body: approved ? "Your organizer account is approved. You can now create and publish events." : "Your organizer access was not approved. Contact TicketPulse support for next steps.",
    link: "/organizer",
  })
  return respond({ ok: true, approved, message: approved ? "Organizer approved." : "Organizer access removed." })
}
