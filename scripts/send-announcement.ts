/**
 * Sends a "What's new on TicketPulse" announcement email to every user in
 * the database who has an email address.
 *
 * Usage:
 *   npx tsx scripts/send-announcement.ts         # send for real
 *   npx tsx scripts/send-announcement.ts --dry    # preview only
 *
 * Set a batch delay (ms) between sends to avoid rate limits.
 */

import * as dotenv from "dotenv"
dotenv.config({ path: ".env.local" })

import { Resend } from "resend"

const FROM = "TicketPulse <no-reply@ticketplse.tech>"
const BATCH_DELAY_MS = 500 // 500 ms between sends = ~2 emails/sec
const DRY_RUN = process.argv.includes("--dry")

async function main() {
  // dynamic-import AFTER dotenv has populated process.env, so the
  // module-level neon() call sees DATABASE_URL.
  const { db } = await import("@/db")
  const { users } = await import("@/db/schema")
  const { announcementEmail } = await import("@/lib/email-templates")

  // Resend API client — only initialised for real sends.
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

  const allUsers = await db
    .select({ id: users.id, name: users.name, email: users.email, role: users.role })
    .from(users)

  const valid = allUsers.filter((u): u is typeof u & { email: string } => !!u.email)
  console.log(`Found ${allUsers.length} users, ${valid.length} with email addresses.`)

  if (DRY_RUN) {
    console.log("\n── DRY RUN ── Would send to:")
    for (const u of valid) {
      console.log(`  ${u.email}  |  ${u.name ?? "—"}  (${u.role ?? "attendee"})`)
    }
    console.log(`\nTotal: ${valid.length} emails`)
    return
  }

  let sent = 0
  let failed = 0

  for (const u of valid) {
    const { html, text } = announcementEmail({ name: u.name })
    const label = u.name ?? u.email

    try {
      await sendEmail(
        u.email,
        "New on TicketPulse: PWA, Google Sign-In, PDF tickets & more",
        html,
        text,
      )
      console.log(`✓ ${label} <${u.email}>`)
      sent++
    } catch (err) {
      console.error(`✗ ${label} <${u.email}> — ${err}`)
      failed++
    }

    // Small delay between sends to be nice to the Resend API.
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
