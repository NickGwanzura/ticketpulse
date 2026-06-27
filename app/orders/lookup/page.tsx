import Link from "next/link"
import { eq, and, inArray } from "drizzle-orm"
import { db } from "@/db"
import { orders, events } from "@/db/schema"
import { ArrowRight, Ticket, Search, Mail, Send } from "lucide-react"
import { formatCurrency } from "@/lib/utils"
import { resendLookupTicketsAction } from "./actions"

export const metadata = { title: "Find my tickets · TicketPulse" }

type Props = { searchParams: Promise<{ email?: string; sent?: string; error?: string }> }

export default async function OrderLookupPage({ searchParams }: Props) {
  const { email, sent, error } = await searchParams
  const trimmedEmail = email?.trim().toLowerCase()

  let results: {
    id: string
    status: string | null
    totalAmount: string | null
    currency: string | null
    createdAt: Date | null
    eventTitle: string | null
    eventSlug: string | null
  }[] = []

  if (trimmedEmail) {
    const rows = await db
      .select({
        id: orders.id,
        status: orders.status,
        totalAmount: orders.totalAmount,
        currency: orders.currency,
        createdAt: orders.createdAt,
        eventTitle: events.title,
        eventSlug: events.slug,
      })
      .from(orders)
      .leftJoin(events, eq(events.id, orders.eventId))
      .where(
        and(
          eq(orders.guestEmail, trimmedEmail),
          inArray(orders.status, ["paid", "completed", "pending", "awaiting_verification"]),
        ),
      )
      .limit(20)

    results = rows
  }

  const statusLabel: Record<string, string> = {
    paid: "Paid",
    completed: "Completed",
    pending: "Pending",
    awaiting_verification: "Processing",
  }

  const statusColor: Record<string, string> = {
    paid: "text-emerald-700 bg-emerald-50",
    completed: "text-emerald-700 bg-emerald-50",
    pending: "text-amber-700 bg-amber-50",
    awaiting_verification: "text-blue-700 bg-blue-50",
  }

  const errorMessage: Record<string, string> = {
    missing_email: "Enter your checkout email first.",
    not_found: "We could not match that order to this email address.",
    not_ready: "Tickets can only be resent once payment is confirmed.",
    event_missing: "We could not load the event for that order.",
  }

  return (
    <div className="max-w-2xl mx-auto px-5 md:px-8 py-16">
      <div className="mb-8">
        <p className="text-[11px] font-semibold tracking-[0.18em] text-blue uppercase mb-2">Order lookup</p>
        <h1 className="text-[28px] font-bold tracking-tight text-ink mb-2">Find my tickets</h1>
        <p className="text-[14px] text-ink-2">
          Enter the email address you used at checkout to see your orders.
        </p>
      </div>

      <form
        action="/orders/lookup"
        method="GET"
        className="flex gap-2 mb-8"
      >
        <div className="relative flex-1">
          <Mail size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3" />
          <input
            type="email"
            name="email"
            required
            defaultValue={trimmedEmail ?? ""}
            placeholder="you@example.com"
            className="w-full bg-paper border border-line rounded-xl pl-10 pr-4 py-3 text-[14px] text-ink placeholder:text-ink-3 focus:outline-none focus:border-blue focus:ring-4 focus:ring-blue/10 transition"
          />
        </div>
        <button
          type="submit"
          className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-3 text-[14px] font-semibold text-white shadow-sm hover:bg-brand-700 transition"
        >
          <Search size={14} /> Search
        </button>
      </form>

      {sent && (
        <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[13px] font-medium text-emerald-800">
          Ticket email sent for order {sent}. Check your inbox and spam folder.
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] font-medium text-rose-700">
          {errorMessage[error] ?? "Could not resend tickets. Please contact support."}
        </div>
      )}

      {trimmedEmail && results.length === 0 && (
        <div className="rounded-2xl border border-line bg-paper-2 p-8 text-center">
          <Ticket size={28} className="mx-auto mb-3 text-ink-3" />
          <p className="text-[15px] font-semibold text-ink mb-1">No orders found</p>
          <p className="text-[13px] text-ink-2">
            No orders found for <span className="font-medium">{trimmedEmail}</span>.
            Make sure you use the same email you entered at checkout.
          </p>
          <p className="mt-4 text-[13px] text-ink-3">
            Still can&apos;t find it?{" "}
            <a href="mailto:nick@ticketpulse.tech" className="underline hover:text-ink transition">
              Contact support
            </a>
          </p>
        </div>
      )}

      {results.length > 0 && (
        <ul className="space-y-3">
          {results.map((order) => (
            <li key={order.id}>
              <div className="rounded-2xl border border-line bg-paper p-5">
                <div className="flex items-center justify-between gap-4">
                  <Link href={`/orders/${order.id}`} className="group flex items-start gap-3 min-w-0 flex-1">
                    <span className="shrink-0 mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-paper-2 text-ink-2 ring-1 ring-line">
                      <Ticket size={16} />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[14px] font-semibold text-ink truncate">
                        {order.eventTitle ?? "Event"}
                      </p>
                      <p className="text-[12px] text-ink-3 mt-0.5">
                        {order.createdAt
                          ? new Date(order.createdAt).toLocaleDateString("en-GB", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })
                          : "—"}
                        {order.totalAmount && order.currency
                          ? ` · ${formatCurrency(Number(order.totalAmount), order.currency)}`
                          : ""}
                      </p>
                    </div>
                  </Link>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${(order.status && statusColor[order.status]) ?? "text-ink-2 bg-paper-2"}`}>
                      {(order.status && statusLabel[order.status]) ?? order.status ?? "Unknown"}
                    </span>
                    <Link href={`/orders/${order.id}`} aria-label="Open order">
                      <ArrowRight size={14} className="text-ink-3 hover:text-ink transition" />
                    </Link>
                  </div>
                </div>
                {(order.status === "paid" || order.status === "completed") && trimmedEmail && (
                  <form action={resendLookupTicketsAction.bind(null, order.id, trimmedEmail)} className="mt-4 pt-4 border-t border-line">
                    <button
                      type="submit"
                      className="inline-flex items-center gap-2 rounded-lg bg-ink px-3.5 py-2 text-[12px] font-semibold text-white hover:bg-ink/85 transition-colors"
                    >
                      <Send size={13} /> Resend ticket email
                    </button>
                  </form>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {!trimmedEmail && (
        <p className="text-[13px] text-ink-3 text-center mt-4">
          Your order history is also saved in your{" "}
          <Link href="/orders" className="underline hover:text-ink transition">
            order history
          </Link>{" "}
          on this device.
        </p>
      )}
    </div>
  )
}
