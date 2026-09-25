import { redirect } from "next/navigation"

// The order page is the single post-payment destination (confirmation hero,
// tickets, receipt). This route stays only so old links keep working.
export default async function CheckoutSuccessPage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const { id } = await searchParams
  redirect(id ? `/orders/${encodeURIComponent(id)}?welcome=1` : "/orders")
}
