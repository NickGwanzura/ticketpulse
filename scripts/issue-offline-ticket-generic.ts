import { db } from "../db"
import { events, ticketTiers, orders, orderItems } from "../db/schema"
import { ilike, eq } from "drizzle-orm"
import { completeAndSendAction } from "../lib/order-recovery"

// Parameterized offline (cash/manual) ticket issue.
// Run with env loaded, e.g.:
//   node --env-file=.env.local --conditions=react-server --import tsx scripts/issue-offline-ticket-generic.ts \
//     --event olive --name "Jane Doe" --email jane@example.com --phone 07XXXXXXXX
//     # dry run — lists matching event(s) + tiers, shows what would happen
//   add --tier <tierId> --qty 2 --ref "collected by X" --confirm to actually issue + email the ticket

function arg(flag: string): string | null {
  const i = process.argv.indexOf(flag)
  return i >= 0 ? process.argv[i + 1] : null
}

const EVENT_MATCH = arg("--event")
const TIER_ID = arg("--tier")
const GUEST_NAME = arg("--name")
const GUEST_EMAIL = arg("--email")
const GUEST_PHONE = arg("--phone")
const QUANTITY = parseInt(arg("--qty") ?? "1", 10)
const PAYMENT_METHOD = arg("--method") ?? "offline_cash"
const PAYMENT_REF = arg("--ref") ?? `offline-${Date.now()}`
const COMPLETED_BY = arg("--by") ?? "admin"
const CONFIRM = process.argv.includes("--confirm")

async function main() {
  if (!EVENT_MATCH) {
    console.error("Usage: --event <title-match> [--tier <tierId>] [--name X --email Y --phone Z --qty N --ref R --by B] [--confirm]")
    process.exit(1)
  }

  const matchedEvents = await db
    .select({ id: events.id, title: events.title, status: events.status, startsAt: events.startsAt })
    .from(events)
    .where(ilike(events.title, `%${EVENT_MATCH}%`))

  if (matchedEvents.length === 0) {
    console.error(`No event found matching "%${EVENT_MATCH}%"`)
    process.exit(1)
  }

  for (const ev of matchedEvents) {
    console.log(`Event: ${ev.title} [${ev.status}] starts=${ev.startsAt.toISOString()} (${ev.id})`)
    const tiers = await db.select().from(ticketTiers).where(eq(ticketTiers.eventId, ev.id))
    for (const t of tiers) {
      console.log(`  tier ${t.id}  ${t.name}  price=${t.price} ${t.currency}  sold=${t.soldQuantity}/${t.totalQuantity}`)
    }
  }

  if (!CONFIRM) {
    console.log("\nDry run. Re-run with --tier <tierId> --name .. --email .. --confirm to issue.")
    process.exit(0)
  }

  if (!TIER_ID || !GUEST_NAME || !GUEST_EMAIL) {
    console.error("--confirm requires --tier, --name and --email")
    process.exit(1)
  }
  if (!Number.isFinite(QUANTITY) || QUANTITY < 1) {
    console.error("--qty must be at least 1")
    process.exit(1)
  }

  const event = matchedEvents.length === 1
    ? matchedEvents[0]
    : (await db.select({ eventId: ticketTiers.eventId }).from(ticketTiers).where(eq(ticketTiers.id, TIER_ID)).limit(1))
      .map((r) => matchedEvents.find((e) => e.id === r.eventId))[0]
  if (!event) {
    console.error(`Tier ${TIER_ID} not found among matched events`)
    process.exit(1)
  }

  const [tier] = await db.select().from(ticketTiers).where(eq(ticketTiers.id, TIER_ID)).limit(1)
  if (!tier || tier.eventId !== event.id) {
    console.error(`Tier ${TIER_ID} not found on event "${event.title}"`)
    process.exit(1)
  }

  const remaining = tier.totalQuantity - (tier.soldQuantity ?? 0)
  if (remaining < QUANTITY) {
    console.error(`Tier "${tier.name}" only has ${remaining} remaining, need ${QUANTITY}`)
    process.exit(1)
  }

  const total = (Number(tier.price) * QUANTITY).toFixed(2)

  const [order] = await db
    .insert(orders)
    .values({
      eventId: event.id,
      status: "pending",
      totalAmount: total,
      currency: tier.currency ?? "USD",
      paymentMethod: PAYMENT_METHOD,
      paymentRef: PAYMENT_REF,
      guestEmail: GUEST_EMAIL,
      guestName: GUEST_NAME,
      guestPhone: GUEST_PHONE,
      metadata: { source: "offline_manual_issue", issuedBy: COMPLETED_BY },
    })
    .returning()

  await db.insert(orderItems).values({
    orderId: order.id,
    tierId: tier.id,
    type: "ticket",
    quantity: QUANTITY,
    unitPrice: tier.price,
    total,
  })

  console.log(`Created order ${order.id}. Completing and sending...`)

  const result = await completeAndSendAction(order.id, "manual-script", COMPLETED_BY)
  console.log(JSON.stringify(result, null, 2))

  process.exit(result.success ? 0 : 1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
