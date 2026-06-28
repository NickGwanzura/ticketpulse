import { NextResponse } from "next/server"
import { sendAdminAlert } from "@/lib/whatsapp"
import { contactFormAlert } from "@/lib/whatsapp-templates"
import { log } from "@/lib/logger"
import { rateLimit } from "@/lib/rate-limit"

const contactLimiter = rateLimit({ windowMs: 60_000, max: 5 })

/**
 * POST /api/contact
 *
 * Handles contact form submissions. Sends a WhatsApp alert to the platform
 * admin with the submitter's details and message.
 *
 * Body: { name, email, topic, message }
 */
export async function POST(req: Request) {
  const rl = contactLimiter.checkRequest(req)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } },
    )
  }

  try {
    const body = await req.json()
    const { name, email, topic, message } = body

    if (!name || !email || !message) {
      return NextResponse.json(
        { error: "Name, email, and message are required" },
        { status: 400 },
      )
    }

    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ?? "https://ticketpulse.tech"

    await sendAdminAlert(contactFormAlert(name, email, topic, message))

    log.info("contact — WhatsApp alert sent", { name, email, topic })

    return NextResponse.json({ ok: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    log.error("contact — failed to send alert", { error: msg })
    // Don't expose internal errors to the user
    return NextResponse.json({ ok: true })
  }
}
