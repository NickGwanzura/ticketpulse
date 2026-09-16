import * as dotenv from "dotenv"
dotenv.config({ path: ".env.local" })

/**
 * Creates the Pregame Entertainment / Royal Musiq event:
 *   - owner user  : primexscales@gmail.com  (role=organizer, organizerSlug=pregame-entertainment)
 *   - event       : Royal Musiq @ Queen of Hearts, Harare, 13 Dec
 *   - tiers       : Early Bird VIP $35 x100, Early Bird GA $15 x200
 *   - invite      : outjoyment@gmail.com as an event collaborator (pending, NOT emailed)
 *
 * Mirrors app/organizer/events/[id]/organisers/actions.ts for the invite row
 * shape (token + 72h expiry) so the existing /invite/<token> accept flow works.
 *
 * Usage:
 *   npx tsx scripts/seed-royal-musiq.ts --dry-run
 *   ROYAL_OWNER_PASSWORD='...' npx tsx scripts/seed-royal-musiq.ts --commit
 *   ROYAL_OWNER_PASSWORD='...' SEND_INVITES=1 npx tsx scripts/seed-royal-musiq.ts --commit
 *
 * SEND_INVITES=1 sends the real invitation email (via Resend) to the
 * collaborator. Without it, the pending invite row is created and no mail
 * leaves the system.
 *
 * If the owner user does not exist it is created (role=organizer, email
 * pre-verified so they can sign in immediately) using ROYAL_OWNER_PASSWORD.
 */

const OWNER_EMAIL = "primexscales@gmail.com"
const COLLAB_EMAIL = "outjoyment@gmail.com"
const ORGANISER_NAME = "Pregame Entertainment"
const ORGANISER_SLUG = "pregame-entertainment"

const EVENT_TITLE = "Royal Musiq"
const EVENT_SLUG = "royal-musiq"
const VENUE = "Queen of Hearts"
const CITY = "Harare"
const STARTS_AT = new Date("2026-12-13T20:00:00+02:00") // CAT (Africa/Harare, UTC+2)
const ENDS_AT = new Date("2026-12-14T04:00:00+02:00")

const INVITE_EXPIRY_HOURS = 72
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://ticketpulse.tech"

const TIERS = [
  { name: "Early Bird VIP", price: "35.00", totalQuantity: 100 },
  { name: "Early Bird GA", price: "15.00", totalQuantity: 200 },
]

async function main() {
  const commit = process.argv.includes("--commit")
  const dryRun = !commit

  if (!process.env.DATABASE_URL) {
    console.error("❌ DATABASE_URL is not set (expected in .env.local)")
    process.exit(1)
  }

  console.log("\n══════════════════════════════════════════════")
  console.log(commit ? "  COMMIT MODE — writing to database" : "  DRY RUN — no writes (pass --commit to apply)")
  console.log("══════════════════════════════════════════════\n")
  console.log(`  Owner      : ${OWNER_EMAIL}  (${ORGANISER_NAME})`)
  console.log(`  Collaborator: ${COLLAB_EMAIL}  [${process.env.SEND_INVITES === "1" ? "invite row + EMAIL SENT" : "invite row only — no email"}]`)
  console.log(`  Event      : ${EVENT_TITLE} — ${VENUE}, ${CITY}`)
  console.log(`  Starts     : ${STARTS_AT.toISOString()} (${STARTS_AT.toLocaleString("en-ZW", { timeZone: "Africa/Harare" })} CAT)`)
  for (const t of TIERS) console.log(`  Tier       : ${t.name} — $${t.price} x${t.totalQuantity}`)
  console.log("")

  const { db } = await import("@/db")
  const { users, events, ticketTiers, organiserInvites } = await import("@/db/schema")
  const { eq } = await import("drizzle-orm")

  // ── Preflight: resolve or create the owner ─────────────────────────────────
  const [existingOwner] = await db.select().from(users).where(eq(users.email, OWNER_EMAIL)).limit(1)

  if (existingOwner && existingOwner.role !== "organizer" && existingOwner.role !== "admin") {
    console.error(`❌ ${OWNER_EMAIL} exists but role is "${existingOwner.role}", expected "organizer".`)
    process.exit(1)
  }

  if (existingOwner) {
    console.log(`✅ Owner exists: ${existingOwner.name ?? "(no name)"} <${existingOwner.email}> role=${existingOwner.role}`)
  } else if (dryRun) {
    console.log(`ℹ️  Owner ${OWNER_EMAIL} does not exist — would be CREATED as organizer`)
    if (!process.env.ROYAL_OWNER_PASSWORD) {
      console.log(`   ⚠️  ROYAL_OWNER_PASSWORD is not set; --commit would abort.`)
    }
  } else {
    if (!process.env.ROYAL_OWNER_PASSWORD) {
      console.error(`❌ Owner ${OWNER_EMAIL} does not exist and ROYAL_OWNER_PASSWORD is not set.`)
      console.error(`   Re-run with: ROYAL_OWNER_PASSWORD='...' npx tsx scripts/seed-royal-musiq.ts --commit`)
      process.exit(1)
    }
    console.log(`ℹ️  Owner ${OWNER_EMAIL} not found — will be created as organizer`)
  }

  const [existingEvent] = await db.select({ id: events.id }).from(events).where(eq(events.slug, EVENT_SLUG)).limit(1)
  if (existingEvent) {
    console.error(`❌ An event with slug "${EVENT_SLUG}" already exists (${existingEvent.id}). Aborting to avoid a duplicate.`)
    process.exit(1)
  }
  console.log(`✅ Slug "${EVENT_SLUG}" is free`)

  // The app's own actions cap invited organisers at 2 for a brand-new event.
  console.log(`✅ Invite slots: 0 used of 2 — this run creates 1 pending invite`)

  if (dryRun) {
    console.log("\n─── DRY RUN COMPLETE — nothing written. Re-run with --commit to apply. ───\n")
    return
  }

  const now = new Date()

  // ── 1. Owner user (create if missing), carrying Pregame Entertainment branding
  let ownerId: string
  let ownerSlug: string | null

  if (existingOwner) {
    ownerId = existingOwner.id
    ownerSlug = existingOwner.organizerSlug ?? ORGANISER_SLUG
    await db
      .update(users)
      .set({
        name: existingOwner.name ?? ORGANISER_NAME,
        organizerSlug: ownerSlug,
        organizerBio: existingOwner.organizerBio ?? ORGANISER_NAME,
        approvedAt: existingOwner.approvedAt ?? now,
        updatedAt: now,
      })
      .where(eq(users.id, existingOwner.id))
    console.log(`✅ Owner updated with organiser branding (slug: ${ownerSlug})`)
  } else {
    const { hashPassword } = await import("@/lib/password")
    ownerSlug = ORGANISER_SLUG
    const [created] = await db
      .insert(users)
      .values({
        email: OWNER_EMAIL,
        name: ORGANISER_NAME,
        role: "organizer",
        passwordHash: hashPassword(process.env.ROYAL_OWNER_PASSWORD!),
        emailVerified: now, // pre-verified so they can sign in without a round-trip
        organizerSlug: ownerSlug,
        organizerBio: ORGANISER_NAME,
        approvedAt: now,
      })
      .returning({ id: users.id })
    ownerId = created.id
    console.log(`✅ Owner created: ${OWNER_EMAIL} (${ownerId}) slug=${ownerSlug}`)
  }

  // ── 2. Event ──────────────────────────────────────────────────────────────
  const [event] = await db
    .insert(events)
    .values({
      organizerId: ownerId,
      title: EVENT_TITLE,
      slug: EVENT_SLUG,
      description: `${EVENT_TITLE} live at ${VENUE}, ${CITY}. Presented by ${ORGANISER_NAME}.`,
      category: "Music",
      status: "published",
      venue: VENUE,
      city: CITY,
      country: "Zimbabwe",
      startsAt: STARTS_AT,
      endsAt: ENDS_AT,
      tags: ["music", "royal-musiq", "harare"],
    })
    .returning({ id: events.id })
  console.log(`✅ Event created: ${event.id}`)

  // ── 3. Ticket tiers ───────────────────────────────────────────────────────
  await db.insert(ticketTiers).values(
    TIERS.map((t) => ({
      eventId: event.id,
      name: t.name,
      price: t.price,
      currency: "USD",
      totalQuantity: t.totalQuantity,
      soldQuantity: 0,
    })),
  )
  for (const t of TIERS) console.log(`   • tier "${t.name}" — $${t.price} x${t.totalQuantity}`)

  // ── 4. Collaborator invite ────────────────────────────────────────────────
  const token = crypto.randomUUID()
  const expiresAt = new Date(Date.now() + INVITE_EXPIRY_HOURS * 60 * 60 * 1000)

  await db.insert(organiserInvites).values({
    eventId: event.id,
    invitedBy: ownerId,
    email: COLLAB_EMAIL,
    role: "editor",
    token,
    status: "pending",
    expiresAt,
  })

  const inviteUrl = `${APP_URL}/invite/${token}`

  // ── 5. Send the invitation email (opt-in via SEND_INVITES=1) ─────────────
  const shouldSend = process.env.SEND_INVITES === "1"
  let sendOutcome = "not sent (SEND_INVITES not set)"

  if (shouldSend) {
    const { organiserInviteEmail } = await import("@/lib/email-templates")
    const { sendEmail } = await import("@/lib/email")
    const { html, text } = organiserInviteEmail({
      inviterName: ORGANISER_NAME,
      eventTitle: EVENT_TITLE,
      inviteUrl,
      email: COLLAB_EMAIL,
      expiresInHours: INVITE_EXPIRY_HOURS,
    })
    const res = await sendEmail({
      to: COLLAB_EMAIL,
      subject: `You are invited to organise ${EVENT_TITLE}`,
      html,
      text,
    })
    if ("id" in res) {
      sendOutcome = `✅ email sent (Resend id: ${res.id})`
    } else {
      sendOutcome = `⚠️  email SKIPPED — ${res.reason}`
    }
  }

  console.log(`\n══════════════════════════════════════════════`)
  console.log(`  DONE`)
  console.log(`══════════════════════════════════════════════`)
  console.log(`  Event id     : ${event.id}`)
  console.log(`  Public path  : /events/${EVENT_SLUG}`)
  console.log(`  Pending invite for ${COLLAB_EMAIL}`)
  console.log(`  Invite link  : ${inviteUrl}`)
  console.log(`  Expires      : ${expiresAt.toLocaleString("en-ZW", { timeZone: "Africa/Harare" })} CAT`)
  console.log(`  Email        : ${sendOutcome}`)
  console.log(`  Owner login  : ${OWNER_EMAIL}`)
  if (process.env.ROYAL_OWNER_PASSWORD && !existingOwner) {
    console.log(`  Owner password: ${process.env.ROYAL_OWNER_PASSWORD}  ← share securely, then rotate`)
  }
  console.log("")
}

main().catch((err) => {
  console.error("Script failed:", err)
  process.exit(1)
})
