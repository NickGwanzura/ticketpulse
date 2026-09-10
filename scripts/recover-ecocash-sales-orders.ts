import { dbPool } from "../db"
import { recoverPaidSalesOrder } from "../lib/velocity/sales-order-recovery"

async function main() {
  for (const id of process.argv.slice(2)) {
    console.log(JSON.stringify({ id, ...await recoverPaidSalesOrder(id, "verified_sales_order_recovery") }))
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1 }).finally(() => dbPool?.end())
