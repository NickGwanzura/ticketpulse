import { NextResponse } from "next/server"
import { z } from "zod"
import { authenticateOrganizer, privateHeaders } from "@/lib/mobile-organizer"
import { requireEventAccessForUser } from "@/lib/event-access"
import { markTicketScanned } from "@/lib/ticket-scan"
import { apiLimiter } from "@/lib/rate-limit"

const Scan = z.object({ code: z.string().trim().min(1).max(2000), eventId: z.string().uuid() })

export async function POST(request: Request) {
  const rate = apiLimiter.checkRequest(request)
  if (!rate.allowed) return NextResponse.json({ ok: false, error: "Too many requests. Try again shortly." }, {
    status: 429, headers: { ...privateHeaders, "Retry-After": String(Math.ceil(rate.retryAfterMs / 1000)) },
  })
  const identity = await authenticateOrganizer(request)
  if (!identity.ok) return NextResponse.json(identity, { status: identity.status, headers: privateHeaders })
  const input = Scan.safeParse(await request.json().catch(() => null))
  if (!input.success) return NextResponse.json({ ok: false, error: "Choose an event and provide a ticket code" }, { status: 400 })
  const authorize = (eventId: string) => requireEventAccessForUser(eventId, { id: identity.userId, role: identity.role })
  if (!(await authorize(input.data.eventId)).allowed) {
    return NextResponse.json({ ok: false, error: "Access denied for this event" }, { status: 403 })
  }
  const result = await markTicketScanned(input.data.code, {
    eventId: input.data.eventId, scannerUserId: identity.userId, source: "flutter_organizer",
    userAgent: request.headers.get("user-agent"),
    ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim(),
  }, authorize)
  return NextResponse.json(result, { status: result.ok ? 200 : 400, headers: privateHeaders })
}
