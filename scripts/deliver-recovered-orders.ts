import { dbPool } from "../db"
import { deliverTicketForPaidOrder } from "../lib/delivery"

async function main() {
  // Remote operator connections can be slower than the application's server.
  if (dbPool) dbPool.options.connectionTimeoutMillis = 20_000
  for (const id of process.argv.slice(2)) {
    console.log(JSON.stringify({ id, ...await deliverTicketForPaidOrder(id, { notifyOrganizers: false }) }))
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1 }).finally(() => dbPool?.end())
