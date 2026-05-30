import { NextResponse } from "next/server"
import { eq, and, desc, sql } from "drizzle-orm"
import { auth } from "@/auth"
import { db } from "@/db"
import { notifications } from "@/db/schema"

/** GET /api/notifications — list notifications for the current user */
export async function GET(request: Request) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const unreadOnly = searchParams.get("unread") === "true"
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "20", 10), 100)

  const conditions = [eq(notifications.userId, session.user.id)]
  if (unreadOnly) {
    conditions.push(eq(notifications.read, false))
  }

  const rows = await db
    .select()
    .from(notifications)
    .where(and(...conditions))
    .orderBy(desc(notifications.createdAt))
    .limit(limit)

  const [countRow] = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(notifications)
    .where(and(eq(notifications.userId, session.user.id), eq(notifications.read, false)))

  return NextResponse.json({
    notifications: rows,
    unreadCount: countRow?.count ?? 0,
  })
}

/** POST /api/notifications/read — mark specific notifications as read */
export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = (await request.json().catch(() => ({}))) as {
    ids?: string[]
    all?: boolean
  }

  if (body.all) {
    await db
      .update(notifications)
      .set({ read: true })
      .where(and(eq(notifications.userId, session.user.id), eq(notifications.read, false)))
    return NextResponse.json({ success: true })
  }

  if (!body.ids || body.ids.length === 0) {
    return NextResponse.json({ error: "No IDs provided" }, { status: 400 })
  }

  await db
    .update(notifications)
    .set({ read: true })
    .where(
      and(
        eq(notifications.userId, session.user.id),
        sql`${notifications.id} = ANY(${body.ids})`,
      ),
    )

  return NextResponse.json({ success: true })
}
