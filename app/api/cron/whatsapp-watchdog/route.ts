import { NextResponse } from "next/server"
import { verifyCronSecret } from "@/lib/cron-auth"
import { sendEmail, adminEmail } from "@/lib/email"
import { log } from "@/lib/logger"
import { getSession } from "@/lib/whatsapp"

/**
 * Daily health-check for the configured Gupshup WhatsApp app.
 * Sends an email alert to the admin if the app profile cannot be reached.
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

  if (!process.env.GUPSHUP_API_KEY || !process.env.GUPSHUP_APP_ID || !process.env.GUPSHUP_APP_NAME || !process.env.GUPSHUP_SOURCE) {
    log.warn("cron/whatsapp-watchdog — Gupshup not configured, skipping")
    return NextResponse.json({ skipped: true, reason: "Gupshup not configured" })
  }

  let status = "unknown"
  try {
    status = (await getSession()).status
  } catch (err) {
    status = "unreachable"
    log.error("cron/whatsapp-watchdog — failed to reach Gupshup", { error: err instanceof Error ? err.message : String(err) })
  }

  if (status === "ready") {
    log.info("cron/whatsapp-watchdog — Gupshup app ready")
    return NextResponse.json({ ok: true, status })
  }

  log.warn("cron/whatsapp-watchdog — Gupshup app not ready", { status })

  await sendEmail({
    to: adminEmail,
    subject: "ACTION REQUIRED: TicketPulse Gupshup WhatsApp connection is down",
    html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1a1a1a">
<h2 style="color:#dc2626;font-size:20px;margin-bottom:8px">Gupshup connection not ready</h2>
<p>The daily health-check could not verify the Gupshup app profile. Status: <strong>${status}</strong></p>
<p>Ticket PDFs and notifications are <strong>not being delivered via WhatsApp</strong> until this is resolved.</p>
<p><strong>To fix:</strong> verify the Gupshup app credentials and sender status in the Gupshup dashboard.</p>
<p style="margin-top:24px;color:#6b7280;font-size:13px">
  App: ${process.env.GUPSHUP_APP_NAME}<br/>
  Sender: ${process.env.GUPSHUP_SOURCE}<br/>
  Checked at: ${new Date().toUTCString()}
</p>
<p style="color:#6b7280;font-size:13px">TicketPulse automated watchdog</p>
</div>`,
    text: `Gupshup WhatsApp app status is ${status}.\n\nTicket PDFs and notifications are not being delivered until the connection is restored.\n\nVerify the Gupshup app credentials and sender status.\n\nApp: ${process.env.GUPSHUP_APP_NAME}\nSender: ${process.env.GUPSHUP_SOURCE}\nChecked at: ${new Date().toUTCString()}`,
  }).catch((err) => log.error("cron/whatsapp-watchdog — alert email failed", { error: String(err) }))

  return NextResponse.json({ ok: false, status, alerted: true })
}
