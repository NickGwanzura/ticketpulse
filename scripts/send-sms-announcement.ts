/**
 * One-off: announce SMS ticket delivery to all organizers.
 * npx tsx scripts/send-sms-announcement.ts
 */

import fs from "fs"
import path from "path"

// Parse .env.local without a dotenv dependency
const envPath = path.resolve(process.cwd(), ".env.local")
for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
  const [key, ...rest] = line.split("=")
  if (key && rest.length && !key.startsWith("#")) {
    process.env[key.trim()] = rest.join("=").trim()
  }
}

import { Resend } from "resend"
import { neon } from "@neondatabase/serverless"

const RESEND_KEY = process.env.AUTH_RESEND_KEY
const DATABASE_URL = process.env.DATABASE_URL

if (!RESEND_KEY) { console.error("AUTH_RESEND_KEY not set"); process.exit(1) }
if (!DATABASE_URL) { console.error("DATABASE_URL not set"); process.exit(1) }

const resend = new Resend(RESEND_KEY)
const sql = neon(DATABASE_URL)

const SUBJECT = "Your buyers now receive tickets by SMS too"

// Extra recipients who should always receive a copy (e.g. founders, team)
const ALWAYS_CC: { name: string; email: string }[] = [
  { name: "Nicholas", email: "nicholas.gwanzura@outlook.com" },
]

function buildHtml(firstName: string): string {
  const appUrl = "https://ticketpulse.tech"
  const paragraphs = [
    `We just shipped something for your attendees — and, honestly, for you.`,
    `Every ticket sold through TicketPulse now goes out three ways the moment payment clears: <strong>email, WhatsApp, and SMS</strong>.`,
    `The SMS means your buyers have their confirmation and QR code sitting in their messages app, even if they miss the email or don't check WhatsApp. At the gate, that is one fewer person saying &ldquo;I did not get it&rdquo; — and one fewer hold-up in the queue.`,
    `We build tools like this because we know a sale is not done until the person walks through the door. Every improvement between checkout and entry is one less thing you have to handle on the day.`,
    `More coming. Thank you for selling through TicketPulse — we are here to help you sell more.`,
  ].map(p => `<p style="margin:0 0 16px;font-size:15px;line-height:26px;color:#384151;">${p}</p>`).join("")

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>${SUBJECT}</title>
</head>
<body style="margin:0;padding:0;background:#F6F9FC;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0B1220;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#F6F9FC;">
    <tr><td align="center" style="padding:32px 16px;">
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:560px;">

        <tr><td style="padding-bottom:8px;">
          <table role="presentation" cellpadding="0" cellspacing="0"><tr>
            <td style="vertical-align:middle;padding-right:10px;">
              <img src="${appUrl}/logo.svg" alt="TicketPulse" width="32" height="32"
                   style="display:block;outline:none;border:none;border-radius:6px;" />
            </td>
            <td style="vertical-align:middle;">
              <span style="font-size:18px;font-weight:700;letter-spacing:-0.01em;color:#0B1220;">TicketPulse</span>
            </td>
          </tr></table>
        </td></tr>

        <tr><td style="background:#FFFFFF;border:1px solid #E6ECF2;border-radius:16px;padding:32px 28px;box-shadow:0 1px 2px rgba(11,18,32,0.04);">
          <h1 style="margin:0 0 20px;font-size:24px;font-weight:700;line-height:1.2;letter-spacing:-0.02em;color:#0B1220;">
            ${SUBJECT}
          </h1>
          <p style="margin:0 0 16px;font-size:15px;line-height:26px;color:#384151;">Hi {FIRST_NAME},</p>
          ${paragraphs}

          <table role="presentation" cellpadding="0" cellspacing="0" width="100%"
                 style="margin:8px 0 20px;padding:18px;border:1px solid #E6ECF2;border-radius:14px;background:#F6F9FC;">
            <tr>
              <td style="padding:6px 0;font-size:13px;color:#384151;">
                <strong style="color:#0B1220;">Email</strong>&nbsp;&mdash;&nbsp;PDF ticket attached
              </td>
            </tr>
            <tr>
              <td style="padding:6px 0;font-size:13px;color:#384151;">
                <strong style="color:#0B1220;">WhatsApp</strong>&nbsp;&mdash;&nbsp;ticket details + PDF sent to their number
              </td>
            </tr>
            <tr>
              <td style="padding:6px 0;font-size:13px;color:#384151;">
                <strong style="color:#0B1220;">SMS</strong>&nbsp;&mdash;&nbsp;confirmation link delivered to their messages app
              </td>
            </tr>
          </table>

          <p style="margin:0;font-size:14px;color:#6B7280;">— The TicketPulse team</p>
        </td></tr>

        <tr><td style="padding:20px 4px 0;">
          <hr style="border:none;border-top:1px solid #E6ECF2;margin:0 0 16px;" />
          <p style="margin:0;font-size:12px;line-height:18px;color:#6B7280;">
            TicketPulse &middot; Harare, Zimbabwe &middot;
            <a href="${appUrl}" style="color:#384151;text-decoration:underline;">ticketpulse.tech</a>
          </p>
          <p style="margin:6px 0 0;font-size:12px;line-height:18px;color:#6B7280;">
            You are receiving this because you have an organizer account on TicketPulse.
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
}

function buildText(firstName: string): string {
  return [
    SUBJECT,
    "",
    `Hi ${firstName},`,
    "",
    "We just shipped something for your attendees — and, honestly, for you.",
    "",
    "Every ticket sold through TicketPulse now goes out three ways the moment payment clears: email, WhatsApp, and SMS.",
    "",
    "  Email      — PDF ticket attached",
    "  WhatsApp   — ticket details + PDF sent to their number",
    "  SMS        — confirmation link delivered to their messages app",
    "",
    "The SMS means your buyers have their confirmation and QR code sitting in their messages app, even if they miss the email or don't check WhatsApp. At the gate, that is one fewer person saying \"I did not get it\" — and one fewer hold-up in the queue.",
    "",
    "We build tools like this because we know a sale is not done until the person walks through the door. Every improvement between checkout and entry is one less thing you have to handle on the day.",
    "",
    "More coming. Thank you for selling through TicketPulse — we are here to help you sell more.",
    "",
    "— The TicketPulse team",
    "",
    "TicketPulse · ticketpulse.tech",
  ].join("\n")
}

async function send(email: string, name: string | null) {
  const firstName = name?.split(" ")[0]?.trim() ?? "there"
  const html = buildHtml(firstName).replace("{FIRST_NAME}", firstName)
  const text = buildText(firstName)
  await resend.emails.send({
    from: "TicketPulse <no-reply@ticketpulse.tech>",
    to: email,
    subject: SUBJECT,
    html,
    text,
  })
}

async function main() {
  const organizers = await sql`
    SELECT name, email FROM users
    WHERE role IN ('organizer', 'admin')
      AND email IS NOT NULL
    ORDER BY created_at ASC
  ` as { name: string | null; email: string }[]

  // Merge in always-CC list (deduplicate by email)
  const orgEmails = new Set(organizers.map(u => u.email.toLowerCase()))
  const extra = ALWAYS_CC.filter(u => !orgEmails.has(u.email.toLowerCase()))
  const recipients = [...organizers, ...extra]

  console.log(`Sending to ${recipients.length} recipient(s) (${organizers.length} organizer(s) + ${extra.length} extra)`)

  let sent = 0
  let failed = 0

  for (const user of recipients) {
    try {
      await send(user.email, user.name)
      console.log(`  ✓  ${user.email}`)
      sent++
    } catch (err) {
      console.error(`  ✗  ${user.email}:`, err instanceof Error ? err.message : err)
      failed++
    }
    await new Promise(r => setTimeout(r, 200))
  }

  console.log(`\nDone. Sent: ${sent}  Failed: ${failed}`)
}

main().catch(err => { console.error(err); process.exit(1) })
