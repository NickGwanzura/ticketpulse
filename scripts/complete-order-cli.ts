import { or, ilike, like, sql } from "drizzle-orm"
import { db, dbPool } from "../db"
import { orders } from "../db/schema"
import { completeAndSendAction } from "../lib/order-recovery"

// Complete one existing order from a trusted terminal. This deliberately keeps
// organizer email/WhatsApp notifications disabled while preserving buyer ticket
// delivery, ledger updates, attendee records, and the admin audit trail.
//
// Run from the repository root with:
// node --env-file=.env.local --conditions=react-server --import tsx scripts/complete-order-cli.ts \
//   --id-prefix a1a8a8d5 --email joannhamo@gmail.com --confirm

function arg(flag: string): string | null {
  const index = process.argv.indexOf(flag)
  return index >= 0 ? process.argv[index + 1] ?? null : null
}

const idPrefix = arg("--id-prefix")
const email = arg("--email")
const completedBy = arg("--by") ?? process.env.ADMIN_EMAIL ?? "admin@ticketpulse.tech"
const confirmed = process.argv.includes("--confirm")

async function main() {
  if (!idPrefix && !email) {
    throw new Error("Usage: --id-prefix <prefix> and/or --email <email> [--by <admin-email>] [--confirm]")
  }

  const filters = [
    idPrefix ? like(sql`${orders.id}::text`, `${idPrefix}%`) : null,
    email ? ilike(orders.guestEmail, email) : null,
  ].filter((filter): filter is NonNullable<typeof filter> => filter !== null)

  const matches = await db
    .select({
      id: orders.id,
      status: orders.status,
      guestName: orders.guestName,
      guestEmail: orders.guestEmail,
      totalAmount: orders.totalAmount,
      createdAt: orders.createdAt,
    })
    .from(orders)
    .where(or(...filters))
    .limit(10)

  console.log(JSON.stringify(matches, null, 2))

  if (matches.length !== 1) {
    throw new Error(`Refusing to mutate: expected exactly one matching order, found ${matches.length}`)
  }

  if (!confirmed) {
    console.log("Dry run only. Add --confirm to complete this order.")
    return
  }

  const result = await completeAndSendAction(
    matches[0].id,
    "dokploy-cli",
    completedBy,
    { notifyOrganizers: false },
  )

  console.log(JSON.stringify(result, null, 2))
  if (!result.success) process.exitCode = 1
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
  .finally(async () => {
    await dbPool?.end()
  })
