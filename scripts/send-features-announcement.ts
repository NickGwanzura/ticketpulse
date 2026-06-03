/**
 * Send the "Hide organizer name + FAQ" feature announcement to all admins
 * and organisers.
 *
 * Usage:
 *   npx tsx scripts/send-features-announcement.ts         # send for real
 *   npx tsx scripts/send-features-announcement.ts --dry   # preview only
 */

import * as dotenv from "dotenv"
dotenv.config({ path: ".env.local" })

import { Resend } from "resend"

const FROM = "TicketPulse <no-reply@ticketpulse.tech>"
const BATCH_DELAY_MS = 500
const DRY_RUN = process.argv.includes("--dry")

async function main() {
  const { db } = await import("@/db")
  const { users } = await import("@/db/schema")
  const { inArray } = await import("drizzle-orm")

  const resendKey = process.env.AUTH_RESEND_KEY
  let resend: Resend | null = null
  if (resendKey) {
    resend = new Resend(resendKey)
  } else if (!DRY_RUN) {
    console.error("AUTH_RESEND_KEY is not set — refusing to send")
    process.exit(1)
  }

  async function sendEmail(to: string, subject: string, html: string, text?: string) {
    if (!resend) throw new Error("Resend not initialised (AUTH_RESEND_KEY missing)")
    const { data, error } = await resend.emails.send({
      from: FROM,
      to: [to],
      subject,
      html,
      text,
    })
    if (error) {
      throw new Error(error.message ?? "Resend send failed")
    }
    return data?.id ?? ""
  }

  console.log("📋 Fetching admins and organisers…")

  const recipients = await db
    .select({ id: users.id, name: users.name, email: users.email, role: users.role })
    .from(users)
    .where(inArray(users.role, ["admin", "organizer"]))

  const valid = recipients.filter((u): u is typeof u & { email: string } => !!u.email)
  console.log(`Found ${recipients.length} admins/organizers, ${valid.length} with email addresses.`)

  if (DRY_RUN) {
    console.log("\n── DRY RUN ── Would send to:")
    for (const u of valid) {
      console.log(`  ${u.email}  |  ${u.name ?? "—"}  (${u.role})`)
    }
    console.log(`\nTotal: ${valid.length} emails`)
    return
  }

  let sent = 0
  let failed = 0

  for (const u of valid) {
    const first = u.name?.split(" ")[0]?.trim()
    const greeting = first ? `Hey ${first},` : "Hi there,"

    const subject = "New on TicketPulse: Hide your name + FAQ sections for events"

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>New on TicketPulse</title>
</head>
<body style="margin:0;padding:0;background:#F6F9FC;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0B1220;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#F6F9FC;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:560px;">
          <tr>
            <td style="padding-bottom:8px;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="vertical-align:middle;padding-right:10px;">
                    <div style="width:32px;height:32px;border-radius:8px;background:#0B1F4A;text-align:center;line-height:32px;">
                      <span style="display:inline-block;width:6px;height:6px;border-radius:9999px;background:#FFFFFF;vertical-align:middle;"></span>
                    </div>
                  </td>
                  <td style="vertical-align:middle;">
                    <span style="font-size:18px;font-weight:700;letter-spacing:-0.01em;color:#0B1220;">TicketPulse</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="background:#FFFFFF;border:1px solid #E6ECF2;border-radius:16px;padding:32px 28px;">
              <h1 style="margin:0 0 12px;font-size:24px;font-weight:700;line-height:1.2;letter-spacing:-0.02em;color:#0B1220;">
                New on TicketPulse
              </h1>
              <div style="font-size:15px;line-height:24px;color:#384151;">
                <p style="margin:0 0 14px;">${greeting}</p>
                <p style="margin:0 0 14px;">We have just shipped two new features to help you run better events on TicketPulse.</p>
                <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:16px 0 8px;padding:18px;border:1px solid #E6ECF2;border-radius:14px;background:#F6F9FC;">
                  <tr>
                    <td style="padding:0 0 14px;">
                      <table role="presentation" cellpadding="0" cellspacing="0">
                        <tr>
                          <td style="width:32px;vertical-align:top;padding:2px 10px 0 0;"><span style="font-size:16px;">🙈</span></td>
                          <td style="font-size:14px;color:#0B1220;">
                            <strong style="display:block;font-size:14px;margin-bottom:2px;">Hide Your Name from the Event Page</strong>
                            <span style="font-size:13px;color:#384151;">You can now choose to hide &quot;Organized by [your name]&quot; from the public event page. Toggle it on when creating or editing any event — perfect for private events, surprise parties, or when you simply prefer to keep a low profile.</span>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:0;">
                      <table role="presentation" cellpadding="0" cellspacing="0">
                        <tr>
                          <td style="width:32px;vertical-align:top;padding:2px 10px 0 0;"><span style="font-size:16px;">❓</span></td>
                          <td style="font-size:14px;color:#0B1220;">
                            <strong style="display:block;font-size:14px;margin-bottom:2px;">More About This Event — FAQ Section</strong>
                            <span style="font-size:13px;color:#384151;">Add a dedicated &quot;More About This Event&quot; section to any event page. Use it for FAQs, what to bring, dress code, parking info, refund policies, accessibility details — anything your attendees need to know.</span>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
                <p style="margin:16px 0 0;font-size:13px;color:#6B7280;">Both options are available now when you create or edit an event.</p>
              </div>
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0 8px;">
                <tr>
                  <td>
                    <a href="${process.env.NEXT_PUBLIC_APP_URL ?? "https://ticketpulse.tech"}/organizer" style="display:inline-block;padding:12px 22px;border-radius:12px;background:#0B1F4A;color:#FFFFFF;font-size:14px;font-weight:600;text-decoration:none;">Go to organizer dashboard</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 4px 0;">
              <hr style="border:none;border-top:1px solid #E6ECF2;margin:0 0 16px;" />
              <p style="margin:0;font-size:12px;line-height:18px;color:#6B7280;">TicketPulse &middot; Harare, Zimbabwe &middot; <a href="${process.env.NEXT_PUBLIC_APP_URL ?? "https://ticketpulse.tech"}" style="color:#384151;text-decoration:underline;">ticketpulse.tech</a></p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

    const text = [
      "New on TicketPulse",
      "",
      greeting,
      "",
      "We've just shipped two new features to help you run better events:",
      "",
      "🙈 Hide Your Name from the Event Page",
      "Choose to hide 'Organized by [your name]' from the public event page. Perfect for private events or when you prefer to keep a low profile. Toggle it when creating or editing any event.",
      "",
      "❓ More About This Event — FAQ Section",
      "Add a dedicated 'More About This Event' section to any event page. Use it for FAQs, what to bring, dress code, parking info, refund policies, accessibility details — anything attendees need to know.",
      "",
      "Both options are available now when you create or edit an event.",
      "",
      `Go to your dashboard: ${process.env.NEXT_PUBLIC_APP_URL ?? "https://ticketpulse.tech"}/organizer`,
      "",
      "TicketPulse",
    ].join("\n")

    const label = u.name ?? u.email

    try {
      await sendEmail(u.email, subject, html, text)
      console.log(`✓ ${label} <${u.email}>`)
      sent++
    } catch (err) {
      console.error(`✗ ${label} <${u.email}> — ${err}`)
      failed++
    }

    if (sent + failed < valid.length) {
      await new Promise((r) => setTimeout(r, BATCH_DELAY_MS))
    }
  }

  console.log(`\nDone. Sent: ${sent}  |  Failed: ${failed}  |  Total: ${valid.length}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
