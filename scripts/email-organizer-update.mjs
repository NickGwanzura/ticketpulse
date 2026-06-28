/**
 * One-shot: send a product update email to every organizer on TicketPulse.
 * Run with:  node scripts/email-organizer-update.mjs
 */

import { createRequire } from "module"
import { readFileSync } from "fs"
import { fileURLToPath } from "url"
import path from "path"

// ── Load .env.local ───────────────────────────────────────────────────────────
const __dir = path.dirname(fileURLToPath(import.meta.url))
const envPath = path.join(__dir, "..", ".env.local")
const envLines = readFileSync(envPath, "utf8").split("\n")
for (const line of envLines) {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith("#")) continue
  const idx = trimmed.indexOf("=")
  if (idx === -1) continue
  const key = trimmed.slice(0, idx).trim()
  const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, "")
  if (!(key in process.env)) process.env[key] = val
}

const require = createRequire(import.meta.url)
const { neon } = require("@neondatabase/serverless")
const { Resend } = require("resend")

const DB_URL = process.env.DATABASE_URL
const RESEND_KEY = process.env.AUTH_RESEND_KEY

if (!DB_URL)  { console.error("DATABASE_URL not set"); process.exit(1) }
if (!RESEND_KEY) { console.error("AUTH_RESEND_KEY not set"); process.exit(1) }

const sql  = neon(DB_URL)
const resend = new Resend(RESEND_KEY)

// ── Fetch organizers ──────────────────────────────────────────────────────────
const organizers = await sql`
  SELECT id, name, email
  FROM   users
  WHERE  role = 'organizer'
  AND    email IS NOT NULL
  ORDER  BY created_at ASC
`

console.log(`Found ${organizers.length} organizer(s)`)
if (organizers.length === 0) process.exit(0)

// ── Email content ─────────────────────────────────────────────────────────────
const APP_URL = "https://ticketpulse.tech"

const BRAND = {
  ink:   "#0B1220",
  ink2:  "#384151",
  ink3:  "#6B7280",
  paper: "#FFFFFF",
  paper2:"#F6F9FC",
  line:  "#E6ECF2",
  navy:  "#0B1F4A",
}

function esc(s) {
  return String(s).replace(/[<>&"']/g, c =>
    ({ "<":"&lt;",">":"&gt;","&":"&amp;",'"':"&quot;","'":"&#39;" }[c])
  )
}

function feature(emoji, label, desc) {
  return `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid ${BRAND.line};">
        <table role="presentation" cellpadding="0" cellspacing="0">
          <tr>
            <td style="width:36px;vertical-align:top;padding-top:2px;font-size:20px;">${emoji}</td>
            <td style="padding-left:10px;">
              <p style="margin:0;font-size:14px;font-weight:600;color:${BRAND.ink};">${esc(label)}</p>
              <p style="margin:2px 0 0;font-size:13px;line-height:20px;color:${BRAND.ink2};">${esc(desc)}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>`
}

function buildHtml(name) {
  const firstName = name ? name.trim().split(" ")[0] : "there"

  const body = `
    <p style="margin:0 0 16px;font-size:15px;line-height:24px;color:${BRAND.ink2};">
      Hi ${esc(firstName)},
    </p>
    <p style="margin:0 0 20px;font-size:15px;line-height:24px;color:${BRAND.ink2};">
      We've been building quietly — and this week we shipped a bunch of things that
      are going straight into your hands as an organizer. Every single one of these
      came from watching how you use TicketPulse and thinking hard about what would
      make your life easier and your events more beautiful.
    </p>

    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 24px;">
      ${feature("🎤", "Lineup management", "Add your artists, DJs, speakers, or performers right on your event. Attendees see who's on the bill — and it looks great.")}
      ${feature("📊", "Capacity at a glance", "A new Capacity page shows you exactly how full each tier is, with a live fill-rate bar. No more mental maths.")}
      ${feature("🔍", "SEO for your event", "Set a custom meta title and description so your event shows up exactly the way you want in Google and on WhatsApp previews.")}
      ${feature("💸", "You choose who pays the fee", "You can now decide: pass our 6% platform fee to buyers, or absorb it yourself for a cleaner ticket price. Your call, per event.")}
      ${feature("🌐", "Your own organizer page", "Every organizer now has a public page at ticketpulse.tech/o/your-name — share it, put it in your bio, own it.")}
      ${feature("📈", "Payout trust journey", "We added a clear path from New → Verified → Trusted on your payouts page, so you always know where you stand and what's next.")}
    </table>

    <p style="margin:0 0 16px;font-size:15px;line-height:24px;color:${BRAND.ink2};">
      There are also smaller wins in there: a faster onboarding wizard for new
      organisers, per-attendee registration questions, affiliate program scaffolding
      (coming soon), recurring events (coming soon), and a cleaner event sidebar that
      puts everything exactly where you'd expect it.
    </p>

    <p style="margin:0 0 20px;font-size:15px;line-height:24px;color:${BRAND.ink2};">
      We mean it when we say we want your events to be wholesome and lovely — for
      you, and for every single person who walks through the gate. Keep running
      incredible events. We'll keep building the tools to match.
    </p>

    <p style="margin:0;font-size:15px;line-height:24px;color:${BRAND.ink2};">
      With love,<br />
      <strong style="color:${BRAND.ink};">The TicketPulse team</strong>
    </p>
  `

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>What's new on TicketPulse</title>
</head>
<body style="margin:0;padding:0;background:${BRAND.paper2};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${BRAND.ink};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
    Lineup, capacity, SEO, fee handling, your public page, and more — all live now.
  </div>
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:${BRAND.paper2};">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:560px;">
          <tr>
            <td style="padding-bottom:12px;">
              <span style="font-size:18px;font-weight:700;letter-spacing:-0.01em;color:${BRAND.ink};">TicketPulse</span>
            </td>
          </tr>
          <tr>
            <td style="background:${BRAND.paper};border:1px solid ${BRAND.line};border-radius:16px;padding:32px 28px;box-shadow:0 1px 2px rgba(11,18,32,0.04);">
              <h1 style="margin:0 0 20px;font-size:22px;font-weight:700;line-height:1.25;letter-spacing:-0.02em;color:${BRAND.ink};">
                We built a lot of new things for you ✨
              </h1>
              ${body}
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0 8px;">
                <tr>
                  <td>
                    <a href="${APP_URL}/organizer"
                       style="display:inline-block;padding:12px 22px;border-radius:12px;background:${BRAND.navy};color:#FFFFFF;font-size:14px;font-weight:600;text-decoration:none;letter-spacing:-0.005em;">
                      Open your dashboard →
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 4px 0;">
              <hr style="border:none;border-top:1px solid ${BRAND.line};margin:0 0 16px;" />
              <p style="margin:0;font-size:12px;line-height:18px;color:${BRAND.ink3};">
                TicketPulse &middot; Harare, Zimbabwe &middot;
                <a href="${APP_URL}" style="color:${BRAND.ink2};text-decoration:underline;">ticketpulse.tech</a>
              </p>
              <p style="margin:6px 0 0;font-size:12px;line-height:18px;color:${BRAND.ink3};">
                You're receiving this because you have an organizer account on TicketPulse.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

function buildText(name) {
  const firstName = name ? name.trim().split(" ")[0] : "there"
  return `Hi ${firstName},

We've been building quietly — and this week we shipped a bunch of things that go straight into your hands as an organizer.

What's new:

🎤 Lineup management — add artists, DJs, speakers, performers to your event page.
📊 Capacity at a glance — see how full each tier is with a live fill-rate bar.
🔍 SEO settings — control your event's Google/WhatsApp preview title and description.
💸 Fee handling — choose whether buyers pay the 6% fee or you absorb it per event.
🌐 Public organizer page — your own page at ticketpulse.tech/o/your-name.
📈 Payout trust journey — a clear New → Verified → Trusted track on your payouts page.

Plus: onboarding wizard, per-attendee questions, a cleaner sidebar, and affiliate/recurring event scaffolding (coming soon).

We mean it when we say we want your events to be wholesome and lovely — for you, and for every person who walks through the gate. Keep running incredible events. We'll keep building the tools to match.

With love,
The TicketPulse team

Open your dashboard: ${APP_URL}/organizer
`
}

// ── Send ──────────────────────────────────────────────────────────────────────
const SUBJECT = "We built a lot of new things for you ✨"
const BATCH_SIZE = 100

let sent = 0, failed = 0

for (let i = 0; i < organizers.length; i += BATCH_SIZE) {
  const chunk = organizers.slice(i, i + BATCH_SIZE)
  const payload = chunk.map(org => ({
    from: "TicketPulse <no-reply@ticketpulse.tech>",
    to: [org.email],
    subject: SUBJECT,
    html: buildHtml(org.name),
    text: buildText(org.name),
  }))

  try {
    const { error } = await resend.batch.send(payload)
    if (error) {
      console.error("Batch error:", error)
      failed += chunk.length
    } else {
      sent += chunk.length
      console.log(`Sent ${sent}/${organizers.length}...`)
    }
  } catch (err) {
    console.error("Batch threw:", err.message)
    failed += chunk.length
  }

  if (i + BATCH_SIZE < organizers.length) {
    await new Promise(r => setTimeout(r, 250))
  }
}

console.log(`\n✅ Done. Sent: ${sent}  Failed: ${failed}`)
