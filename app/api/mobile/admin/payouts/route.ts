import { NextResponse } from "next/server"
import { desc, eq } from "drizzle-orm"
import { z } from "zod"
import { db } from "@/db"
import { events, users } from "@/db/schema"
import { authenticateOrganizer, privateHeaders } from "@/lib/mobile-organizer"
import { getEventRevenueSummaries } from "@/lib/revenue-summary"
import { recordManualPayoutForAdmin, type ManualPayoutInput } from "@/app/admin/payouts/actions"

const respond = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: privateHeaders })

const Input = z.object({
  userId: z.string().trim().min(1),
  eventId: z.string().trim().nullish().transform((value) => value ?? ""),
  amount: z.coerce.number().positive().max(100000),
  currency: z.string().trim().min(1).default("USD").transform((value) => value.toUpperCase()),
  method: z.enum(["ecocash", "bank_usd", "cash"]),
  paidDate: z.string().trim().nullish().transform((value) => value ?? ""),
  proofReference: z.string().trim().min(3).max(200),
  notes: z.string().trim().max(500).nullish().transform((value) => value ?? ""),
  confirmOverage: z.boolean().optional().default(false),
})

export async function GET(request: Request) {
  const identity = await authenticateOrganizer(request)
  if (!identity.ok) return respond(identity, identity.status)
  if (identity.role !== "admin") return respond({ ok: false, error: "Admin access required" }, 403)

  const [organizers, eventRows] = await Promise.all([
    db.select({ id: users.id, name: users.name, email: users.email })
      .from(users)
      .where(eq(users.role, "organizer"))
      .orderBy(users.name),
    db.select({ id: events.id, title: events.title, organizerId: events.organizerId, startsAt: events.startsAt })
      .from(events)
      .orderBy(desc(events.startsAt))
      .limit(300),
  ])
  const summaries = await getEventRevenueSummaries(eventRows.map((event) => event.id))
  return respond({
    ok: true,
    organizers,
    events: eventRows.map((event) => ({
      ...event,
      balance: summaries.get(event.id)?.availableBalance ?? 0,
      paidOut: summaries.get(event.id)?.paidOut ?? 0,
      pendingPayouts: summaries.get(event.id)?.pendingPayouts ?? 0,
    })),
  })
}

export async function POST(request: Request) {
  const identity = await authenticateOrganizer(request)
  if (!identity.ok) return respond(identity, identity.status)
  if (identity.role !== "admin") return respond({ ok: false, error: "Admin access required" }, 403)

  const parsed = Input.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return respond({ ok: false, error: parsed.error.issues[0]?.message ?? "Enter valid payout details." }, 400)
  const input = parsed.data as ManualPayoutInput
  const result = await recordManualPayoutForAdmin(input, identity.email ?? identity.userId)
  return respond(result, result.ok ? 200 : 400)
}
