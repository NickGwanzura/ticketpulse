import { NextResponse } from "next/server"
import { and, desc, eq, inArray, sql } from "drizzle-orm"
import { z } from "zod"
import { db } from "@/db"
import { notifications } from "@/db/schema"
import { authenticateRequest } from "@/lib/mobile-auth"
import { privateHeaders } from "@/lib/mobile-organizer"

const response = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: privateHeaders })

export async function GET(request: Request) {
  const auth = await authenticateRequest(request)
  if (!auth.ok) return response(auth, auth.status)
  const params = new URL(request.url).searchParams
  const limit = Math.min(Math.max(Number.parseInt(params.get("limit") ?? "30", 10) || 30, 1), 100)
  const unreadOnly = params.get("unread") === "true"
  const conditions = [eq(notifications.userId, auth.userId)]
  if (unreadOnly) conditions.push(eq(notifications.read, false))
  const [rows, count] = await Promise.all([
    db.select().from(notifications).where(and(...conditions)).orderBy(desc(notifications.createdAt)).limit(limit),
    db.select({ count: sql<number>`count(*)::int` }).from(notifications).where(and(eq(notifications.userId, auth.userId), eq(notifications.read, false))),
  ])
  return response({ ok: true, notifications: rows, unreadCount: Number(count[0]?.count ?? 0) })
}

export async function POST(request: Request) {
  const auth = await authenticateRequest(request)
  if (!auth.ok) return response(auth, auth.status)
  const body = z.object({ all: z.boolean().optional(), ids: z.array(z.string().uuid()).max(100).optional() }).safeParse(await request.json().catch(() => ({})))
  if (!body.success || (!body.data.all && !body.data.ids?.length)) return response({ ok: false, error: "Provide notification IDs or all=true" }, 400)
  const where = body.data.all
    ? and(eq(notifications.userId, auth.userId), eq(notifications.read, false))
    : and(eq(notifications.userId, auth.userId), inArray(notifications.id, body.data.ids ?? []))
  await db.update(notifications).set({ read: true }).where(where)
  return response({ ok: true })
}
