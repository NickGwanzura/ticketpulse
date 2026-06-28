import { NextResponse } from "next/server"
import { db } from "@/db"
import { eventWaitlist } from "@/db/schema"
import { eq } from "drizzle-orm"
import { rateLimit } from "@/lib/rate-limit"

const waitlistLimiter = rateLimit({ windowMs: 60_000, max: 5 })

export async function POST(req: Request) {
  const rl = waitlistLimiter.checkRequest(req)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } },
    )
  }

  try {
    const { email } = await req.json()

    if (!email || typeof email !== "string" || !email.includes("@")) {
      return NextResponse.json({ error: "Please provide a valid email address." }, { status: 400 })
    }

    const trimmed = email.trim().toLowerCase()

    // Duplicate check — silently treat as success so we don't leak list membership
    const [existing] = await db
      .select({ id: eventWaitlist.id })
      .from(eventWaitlist)
      .where(eq(eventWaitlist.email, trimmed))
      .limit(1)

    if (existing) {
      return NextResponse.json({ message: "You're already on the list!" })
    }

    await db.insert(eventWaitlist).values({ email: trimmed })

    return NextResponse.json({ message: "You're on the list! We'll let you know when something new drops." })
  } catch {
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 })
  }
}
