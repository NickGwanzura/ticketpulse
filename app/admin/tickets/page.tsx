import { redirect } from "next/navigation"

/**
 * Tickets page has been consolidated into the Orders page.
 * All ticket management functionality is now available at /admin/orders.
 */
export default async function AdminTicketsPage() {
  redirect("/admin/orders")
}
