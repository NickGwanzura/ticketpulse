import { redirect } from "next/navigation"
import Link from "next/link"
import { and, asc, eq, gte, inArray, lte, sql, type SQL } from "drizzle-orm"
import { CheckCircle2, ExternalLink } from "lucide-react"

import { auth } from "@/auth"
import { db } from "@/db"
import { events, orders } from "@/db/schema"
import PageHeader from "@/components/dashboard/PageHeader"
import EmptyState from "@/components/dashboard/EmptyState"
import { activeOrderListCondition } from "@/lib/order-list-visibility"
import {
  ORDER_ISSUES,
  ORDER_ISSUE_LABEL,
  orderIssueCondition,
  orderIssueWindowStart,
} from "@/lib/order-issues"
import { formatCurrency, formatDateShort } from "@/lib/utils"

const PER_GROUP = 50
const STUCK_AFTER_MINUTES = 30
const STUCK_WINDOW_DAYS = 7

type Group = {
  key: string
  title: string
  hint: string
  condition: SQL
  window: Date
}

async function loadGroup(group: Group) {
  const where = and(activeOrderListCondition, group.condition, gte(orders.createdAt, group.window))
  const [countRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(orders)
    .where(where)
  const rows = await db
    .select({
      id: orders.id,
      status: orders.status,
      totalAmount: orders.totalAmount,
      currency: orders.currency,
      guestName: orders.guestName,
      guestEmail: orders.guestEmail,
      createdAt: orders.createdAt,
      eventTitle: events.title,
    })
    .from(orders)
    .leftJoin(events, eq(orders.eventId, events.id))
    .where(where)
    .orderBy(asc(orders.createdAt))
    .limit(PER_GROUP)
  return { ...group, total: countRow?.count ?? 0, rows }
}

export default async function NeedsAttentionPage() {
  const session = await auth()
  if (!session?.user || session.user.role !== "admin") {
    redirect("/auth/signin?callbackUrl=/admin/needs-attention")
  }

  const now = Date.now()
  const issueWindow = orderIssueWindowStart()
  const groups: Group[] = [
    ...ORDER_ISSUES.map((issue) => ({
      key: issue,
      title: ORDER_ISSUE_LABEL[issue],
      hint:
        issue === "paid_no_tickets"
          ? "Customer paid but nothing was issued. Use Complete & send."
          : issue === "delivery_failed"
            ? "Tickets exist but email or WhatsApp delivery failed. Check the contact details, then resend."
            : "More than one settled payment on one order. Review before refunding.",
      condition: orderIssueCondition(issue),
      window: issueWindow,
    })),
    {
      key: "stuck_pending",
      title: "Payment stuck pending",
      hint: `Unpaid for over ${STUCK_AFTER_MINUTES} minutes. Recheck with the gateway before the customer gives up.`,
      condition: and(
        inArray(orders.status, ["pending", "awaiting_verification"]),
        lte(orders.createdAt, new Date(now - STUCK_AFTER_MINUTES * 60_000)),
      ) as SQL,
      window: new Date(now - STUCK_WINDOW_DAYS * 86_400_000),
    },
  ]

  const results = await Promise.all(groups.map(loadGroup))
  const totalOpen = results.reduce((sum, g) => sum + g.total, 0)

  return (
    <div className="tp-fade-up">
      <PageHeader
        eyebrow="Support"
        title="Needs attention"
        subtitle="Orders that likely need a person, oldest first."
        width="full"
      />

      <div className="px-5 md:px-8 py-8 md:py-10 space-y-8">
        {totalOpen === 0 ? (
          <EmptyState
            icon={CheckCircle2}
            title="All clear"
            body="No stuck payments or failed deliveries right now."
            variant="inline"
          />
        ) : (
          results
            .filter((g) => g.total > 0)
            .map((g) => (
              <section key={g.key} className="rounded-2xl border border-line bg-paper overflow-hidden">
                <div className="px-5 md:px-6 py-4 border-b border-line">
                  <h2 className="text-[15px] font-semibold tracking-tight text-ink">
                    {g.title} <span className="text-ink-3 font-medium">({g.total})</span>
                  </h2>
                  <p className="text-[12px] text-ink-3 mt-0.5">{g.hint}</p>
                </div>
                <ul className="divide-y divide-line">
                  {g.rows.map((o) => (
                    <li key={o.id} className="px-5 md:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[13px] text-ink truncate">
                          <span className="font-mono text-ink-3">#{o.id.slice(0, 8)}</span>{" "}
                          {o.guestName ?? o.guestEmail ?? "—"}
                        </p>
                        <p className="text-[11px] text-ink-3 truncate">
                          {o.eventTitle ?? "—"} · {o.createdAt ? formatDateShort(o.createdAt) : "—"}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-[13px] font-bold tabular-nums text-ink">
                          {formatCurrency(Number(o.totalAmount ?? 0), o.currency ?? "USD")}
                        </span>
                        <Link
                          href={`/admin/orders/${o.id}`}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-[12px] font-medium text-ink-2 hover:text-ink hover:bg-paper-2"
                        >
                          <ExternalLink size={12} /> Open
                        </Link>
                      </div>
                    </li>
                  ))}
                </ul>
                {g.total > g.rows.length && (
                  <p className="px-5 md:px-6 py-3 text-[12px] text-ink-3 border-t border-line">
                    Showing the oldest {g.rows.length} of {g.total}.
                  </p>
                )}
              </section>
            ))
        )}
      </div>
    </div>
  )
}
