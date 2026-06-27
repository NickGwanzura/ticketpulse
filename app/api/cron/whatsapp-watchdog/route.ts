import { NextResponse } from "next/server"
import { verifyCronSecret } from "@/lib/cron-auth"
import { sendEmail, adminEmail } from "@/lib/email"
import { log } from "@/lib/logger"

/**
 * Daily health-check for the OpenWA WhatsApp session.
 * Sends an email alert to the admin if the session is not ready.
 *
 * Gated to run once per day: fires only during the 07:00 UTC hour.
 * When called from the every-minute tick this means it runs at most once per day.
 */
export async function POST(request: Request) {
  const authError = verifyCronSecret(request)
  if (authError) return authError

  const hourUTC = new Date().getUTCHours()
  if (hourUTC !== 7) {
    return NextResponse.json({ skipped: true, reason: "not the watchdog hour" })
  }

  const baseUrl = process.env.OPENWA_URL
  const apiKey = process.env.OPENWA_API_KEY
  const sessionId = process.env.OPENWA_SESSION_ID

  if (!baseUrl || !apiKey || !sessionId) {
    log.warn("cron/whatsapp-watchdog — OpenWA not configured, skipping")
    return NextResponse.json({ skipped: true, reason: "OpenWA not configured" })
  }

  let status = "unknown"
  try {
    const res = await fetch(`${baseUrl.replace(/\/+$/, "")}/api/sessions/${sessionId}`, {
      headers: { "X-API-Key": apiKey },
      signal: AbortSignal.timeout(10_000),
    })
    const data = await res.json() as { status?: string }
    status = data.status ?? "unknown"
  } catch (err) {
    status = "unreachable"
    log.error("cron/whatsapp-watchdog — failed to reach OpenWA", { error: String(err) })
  }

  if (status === "ready") {
    log.info("cron/whatsapp-watchdog — session ready")
    return NextResponse.json({ ok: true, status })
  }

  log.warn("cron/whatsapp-watchdog — session not ready", { status })

  await sendEmail({
    to: adminEmail,
    subject: "ACTION REQUIRED: TicketPulse WhatsApp session is down",
    html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1a1a1a">
<h2 style="color:#dc2626;font-size:20px;margin-bottom:8px">WhatsApp session not ready</h2>
<p>The daily health-check found the OpenWA session in state: <strong>${status}</strong></p>
<p>Ticket PDFs and notifications are <strong>not being delivered via WhatsApp</strong> until this is resolved.</p>
<p><strong>To fix:</strong> log in to the OpenWA dashboard and re-scan the QR code to reconnect the session.</p>
<p style="margin-top:24px;color:#6b7280;font-size:13px">
  Session ID: ${sessionId}<br/>
  OpenWA URL: ${baseUrl}<br/>
  Checked at: ${new Date().toUTCString()}
</p>
<p style="color:#6b7280;font-size:13px">TicketPulse automated watchdog</p>
</div>`,
    text: `WhatsApp session is ${status}.\n\nTicket PDFs and notifications are not being delivered until the OpenWA session is reconnected.\n\nLog in to the OpenWA dashboard and re-scan the QR code.\n\nSession ID: ${sessionId}\nChecked at: ${new Date().toUTCString()}`,
  }).catch((err) => log.error("cron/whatsapp-watchdog — alert email failed", { error: String(err) }))

  return NextResponse.json({ ok: false, status, alerted: true })
}
