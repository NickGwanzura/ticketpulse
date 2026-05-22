import { NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"
import { drizzle } from "drizzle-orm/neon-http"
import { inArray } from "drizzle-orm"
import { users } from "@/db/schema"
import { sendEmail } from "@/lib/email"
import { groqAiAnnouncementEmail } from "@/lib/email-templates"

export async function POST() {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    return NextResponse.json({ ok: false, error: "DATABASE_URL not set" }, { status: 500 })
  }

  try {
    // Use HTTP-based neon() instead of Pool (which requires WebSocket)
    const sql = neon(databaseUrl)
    const db = drizzle(sql)

    const recipients = await db
      .select({ id: users.id, name: users.name, email: users.email })
      .from(users)
      .where(inArray(users.role, ["admin", "organizer"]))

    if (recipients.length === 0) {
      return NextResponse.json({ ok: true, sent: 0, message: "No admins or organisers found." })
    }

    const results: { email: string; status: "ok" | "skipped" }[] = []

    for (const r of recipients) {
      if (!r.email) {
        results.push({ email: "(no email)", status: "skipped" })
        continue
      }

      const { html, text } = groqAiAnnouncementEmail({ name: r.name })

      try {
        await sendEmail({
          to: r.email,
          subject: "🚀 AI is here on TicketPulse — GROQ-powered tools are live",
          html,
          text,
        })
        results.push({ email: r.email, status: "ok" })
      } catch (e) {
        console.error("[announce] Failed to send to", r.email, e)
        results.push({ email: r.email, status: "skipped" })
      }
    }

    const sent = results.filter((r) => r.status === "ok").length

    return NextResponse.json({
      ok: true,
      sent,
      total: recipients.length,
      results,
    })
  } catch (err) {
    console.error("[announce] Error:", err)
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    )
  }
}
