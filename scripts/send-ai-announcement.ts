/**
 * Send the GROQ AI announcement email to all admins and organisers.
 *
 * Calls Resend API directly (bypasses lib/email.ts which requires Next.js).
 * Uses neon HTTP (bypasses lib/db which uses WebSocket Pool).
 *
 * Usage:
 *   railway run npx tsx scripts/send-ai-announcement.ts
 */

const RESEND_API_KEY = process.env.AUTH_RESEND_KEY
const FROM = "TicketPulse <no-reply@ticketpulse.tech>"
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://ticketpulse.tech"

async function sendViaResend(to: string, subject: string, html: string, text: string) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: FROM, to: [to], subject, html, text }),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Resend returned ${res.status}: ${body}`)
  }
  return res.json()
}

function groqAiAnnouncementEmail(name?: string | null): { html: string; text: string } {
  const first = name?.split(" ")[0]?.trim()
  const greeting = first ? `Hey ${first},` : "Hi there,"

  function escape(s: string): string {
    const m: Record<string, string> = {
      "<": "<",
      ">": ">",
      "&": "&",
      '"': "&quot;",
      "'": "'",
    }
    return s.replace(/[<>&"']/g, (c) => m[c])
  }

  const features = [
    ["✍️", "AI Event Description", "Generate compelling event descriptions instantly. Just pick a title, category, and venue — AI writes the rest."],
    ["📍", "AI Location Suggestions", "Enter a venue name and city — AI fills in the country and address automatically."],
    ["🏷️", "AI Tag Suggestions", "Smart tag recommendations based on your event title and description. Click to add."],
    ["💰", "AI Pricing Suggestions", "Get a suggested price range with reasoning based on your event type, category, and location."],
    ["📱", "AI Social Post Generator", "Generate Twitter/X, Facebook, or Instagram posts for your event. Copy and post in one click."],
    ["📧", "AI Email Copilot", "Draft professional attendee emails with AI. Choose a purpose or write custom instructions."],
    ["📊", "AI Sales Insights", "Get actionable sales tips for each event on your organizer dashboard. One click, instant insight."],
    ["🛡️", "AI Content Moderation", "Admins can now check draft event content for guidelines compliance before approving."],
  ]

  const featureRows = features
    .map(
      ([emoji, title, desc]) => `
      <tr>
        <td style="padding:0 0 14px;">
          <table role="presentation" cellpadding="0" cellspacing="0">
            <tr>
              <td style="width:32px;vertical-align:top;padding:2px 10px 0 0;">
                <span style="font-size:16px;">${emoji}</span>
              </td>
              <td style="font-size:14px;color:#0B1220;">
                <strong style="display:block;font-size:14px;margin-bottom:2px;">${escape(title)}</strong>
                <span style="font-size:13px;color:#384151;">${escape(desc)}</span>
              </td>
            </tr>
          </table>
        </td>
      </tr>`,
    )
    .join("")

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>AI is here on TicketPulse</title>
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
                🚀 AI is here on TicketPulse
              </h1>
              <div style="font-size:15px;line-height:24px;color:#384151;">
                <p style="margin:0 0 14px;">
                  ${escape(greeting)}
                </p>
                <p style="margin:0 0 14px;">
                  We have just shipped a major upgrade — <strong style="color:#0B1220;">AI-powered tools</strong>
                  across the platform, powered by GROQ's Llama 3.3-70B model.
                </p>
                <table role="presentation" cellpadding="0" cellspacing="0" width="100%"
                       style="margin:16px 0 8px;padding:18px;border:1px solid #E6ECF2;border-radius:14px;background:#F6F9FC;">
                  ${featureRows}
                </table>
                <p style="margin:16px 0 0;font-size:13px;color:#6B7280;">
                  All AI features are powered by GROQ's Llama 3.3-70B — fast, free, and running at blazing speed.
                </p>
                <p style="margin:6px 0 0;font-size:13px;color:#6B7280;">
                  Head to your dashboard to try them out.
                </p>
              </div>
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0 8px;">
                <tr>
                  <td>
                    <a href="${APP_URL}/dashboard"
                       style="display:inline-block;padding:12px 22px;border-radius:12px;background:#0B1F4A;color:#FFFFFF;font-size:14px;font-weight:600;text-decoration:none;">
                      Go to dashboard
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 4px 0;">
              <hr style="border:none;border-top:1px solid #E6ECF2;margin:0 0 16px;" />
              <p style="margin:0;font-size:12px;line-height:18px;color:#6B7280;">
                TicketPulse &middot; Harare, Zimbabwe &middot;
                <a href="${APP_URL}" style="color:#384151;text-decoration:underline;">ticketpulse.tech</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

  const text = [
    "🚀 AI is here on TicketPulse",
    "",
    greeting,
    "",
    "We've just shipped AI-powered tools across the platform, powered by GROQ's Llama 3.3-70B:",
    "",
    "✍️ AI Event Description — Generate event descriptions instantly.",
    "📍 AI Location Suggestions — Auto-fill country and address from venue name.",
    "🏷️ AI Tag Suggestions — Smart tags based on your event.",
    "💰 AI Pricing Suggestions — Get suggested price ranges with reasoning.",
    "📱 AI Social Post Generator — Create Twitter/X, Facebook, or Instagram posts.",
    "📧 AI Email Copilot — Draft professional attendee emails with AI.",
    "📊 AI Sales Insights — Actionable tips on your organizer dashboard.",
    "🛡️ AI Content Moderation — For admins reviewing draft events.",
    "",
    "Head to your dashboard to try them out:",
    `${APP_URL}/dashboard`,
    "",
    "TicketPulse",
  ].join("\n")

  return { html, text }
}

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) {
    console.error("❌ DATABASE_URL not set")
    process.exit(1)
  }

  if (!RESEND_API_KEY) {
    console.error("❌ AUTH_RESEND_KEY not set")
    process.exit(1)
  }

  const { neon } = await import("@neondatabase/serverless")
  const { drizzle } = await import("drizzle-orm/neon-http")
  const { inArray } = await import("drizzle-orm")
  const { users } = await import("../db/schema")

  const db = drizzle(neon(url))

  console.log("📋 Fetching admins and organisers…")

  const recipients = await db
    .select({ id: users.id, name: users.name, email: users.email })
    .from(users)
    .where(inArray(users.role, ["admin", "organizer"]))

  console.log(`   Found ${recipients.length} recipient(s)`)
  console.log("")

  if (recipients.length === 0) {
    console.log("⚠️  No admins or organisers found. Nothing to send.")
    return
  }

  let sent = 0
  let skipped = 0

  for (const r of recipients) {
    if (!r.email) {
      console.log(`   ⏭️  ${r.name ?? "Unknown"} — no email address`)
      skipped++
      continue
    }

    const { html, text } = groqAiAnnouncementEmail(r.name)

    try {
      await sendViaResend(r.email, "🚀 AI is here on TicketPulse — GROQ-powered tools are live", html, text)
      console.log(`   ✅ ${r.email} (${r.name ?? "—"})`)
      sent++
    } catch (err) {
      console.log(`   ❌ ${r.email} — ${err instanceof Error ? err.message : "unknown error"}`)
      skipped++
    }
  }

  console.log("")
  console.log(`📊 Done — ${sent} sent, ${skipped} skipped`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
