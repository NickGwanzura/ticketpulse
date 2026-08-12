import * as dotenv from "dotenv"
dotenv.config({ path: ".env.local" })

import { db } from "../db"
import { events, ticketTiers, orders, orderItems } from "../db/schema"
import { ilike, eq } from "drizzle-orm"
import { completeAndSendAction } from "../lib/order-recovery"

// One-off: issue a ticket for an offline (cash/manual) payment.
// order-recovery.ts (and its lib/* imports) are guarded with `import "server-only"`,
// which throws outside Next.js unless the "react-server" export condition is active —
// run this with NODE_OPTIONS="--conditions=react-server" so that guard resolves to a no-op.
// Usage:
//   NODE_OPTIONS="--conditions=react-server" npx tsx scripts/issue-offline-ticket.ts
//     # dry run — lists matching event(s) + tiers
//   NODE_OPTIONS="--conditions=react-server" npx tsx scripts/issue-offline-ticket.ts --tier <tierId> --confirm
//     # creates the order and emails the ticket

const EVENT_TITLE_MATCH = "%olive%"
const GUEST_EMAIL = "darlene.at.work@outlook.com"
const GUEST_NAME = "Jorum Gisiri"
const GUEST_PHONE = "0773965710"
const QUANTITY = 1
const PAYMENT_METHOD = "offline_cash"
const PAYMENT_REF = `offline-${Date.now()}`
const COMPLETED_BY = "gwanzuranicholas@gmail.com"

async function main() {
  const args = process.argv.slice(2)
  const confirm = args.includes("--confirm")
  const tierArgIdx = args.indexOf("--tier")
  const tierArg = tierArgIdx >= 0 ? args[tierArgIdx + 1] : null

  const matchedEvents = await db
    .select({ id: events.id, title: events.title, status: events.status })
    .from(events)
    .where(ilike(events.title, EVENT_TITLE_MATCH))

  if (matchedEvents.length === 0) {
    console.error(`No event found matching "${EVENT_TITLE_MATCH}"`)
    process.exit(1)
  }
  if (matchedEvents.length > 1 && !tierArg) {
    console.log("Multiple matching events found — narrow down by passing --tier <tierId> once you've picked one:")
    for (const ev of matchedEvents) {
      console.log(`\nEvent: ${ev.title} [${ev.status}] (${ev.id})`)
      const tiers = await db.select().from(ticketTiers).where(eq(ticketTiers.eventId, ev.id))
      for (const t of tiers) {
        console.log(`  tier ${t.id}  ${t.name}  price=${t.price} ${t.currency}  sold=${t.soldQuantity}/${t.totalQuantity}`)
      }
    }
    process.exit(0)
  }

  const event = matchedEvents[0]
  const tiers = await db.select().from(ticketTiers).where(eq(ticketTiers.eventId, event.id))

  if (tiers.length === 0) {
    console.error(`Event "${event.title}" has no ticket tiers`)
    process.exit(1)
  }

  const tier = tierArg ? tiers.find((t) => t.id === tierArg) : tiers[0]
  if (!tier) {
    console.error(`Tier ${tierArg} not found on event "${event.title}"`)
    process.exit(1)
  }

  if (!confirm) {
    console.log(`Dry run. Would issue ${QUANTITY}x "${tier.name}" for "${event.title}" to ${GUEST_EMAIL}.`)
    console.log(`Event: ${event.id}`)
    console.log(`Tier:  ${tier.id}  price=${tier.price} ${tier.currency}  sold=${tier.soldQuantity}/${tier.totalQuantity}`)
    console.log(`\nRe-run with: npx tsx scripts/issue-offline-ticket.ts --tier ${tier.id} --confirm`)
    process.exit(0)
  }

  const remaining = tier.totalQuantity - (tier.soldQuantity ?? 0)
  if (remaining < QUANTITY) {
    console.error(`Tier "${tier.name}" only has ${remaining} remaining, need ${QUANTITY}`)
    process.exit(1)
  }

  const unitPrice = tier.price
  const total = (Number(unitPrice) * QUANTITY).toFixed(2)

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
    unitPrice: unitPrice,
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
