import Link from "next/link"
import { redirect } from "next/navigation"
import { CreditCard, CheckCircle2, Clock, Ban } from "lucide-react"
import { desc, eq, sql } from "drizzle-orm"

import { auth } from "@/auth"
import { db } from "@/db"
import { organizerFeeDues, events, users } from "@/db/schema"
import PageHeader from "@/components/dashboard/PageHeader"
import EmptyState from "@/components/dashboard/EmptyState"
import { formatCurrency, formatDateShort } from "@/lib/utils"
import MarkFeeDueSettledButton from "@/app/admin/_components/MarkFeeDueSettledButton"

type FeeDueStatus = "outstanding" | "settled" | "waived"

const STATUS_STYLE: Record<FeeDueStatus, string> = {
  outstanding: "bg-amber-50 text-amber-700",
  settled:     "bg-emerald-50 text-emerald-700",
  waived:      "bg-gray-50 text-gray-600",
}

const STATUS_LABEL: Record<FeeDueStatus, string> = {
  outstanding: "Outstanding",
  settled:     "Settled",
  waived:      "Waived",
}

const TABS: { key: FeeDueStatus | "all"; label: string }[] = [
  { key: "outstanding", label: "Outstanding" },
  { key: "settled",     label: "Settled" },
  { key: "waived",      label: "Waived" },
  { key: "all",         label: "All" },
]

export default async function OrganizerFeeDuesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const session = await auth()
  if (!session?.user || session.user.role !== "admin") {
    redirect("/auth/signin?callbackUrl=/admin/organizer-fees")
  }

  const params = await searchParams
  const active = (params.status as FeeDueStatus | "all" | undefined) ?? "outstanding"

  const rows = await db
    .select({
      id: organizerFeeDues.id,
      grossAmount: organizerFeeDues.grossAmount,
      feeAmount: organizerFeeDues.feeAmount,
      feeRate: organizerFeeDues.feeRate,
      currency: organizerFeeDues.currency,
      status: organizerFeeDues.status,
      settledAt: organizerFeeDues.settledAt,
      settledBy: organizerFeeDues.settledBy,
      note: organizerFeeDues.note,
      createdAt: organizerFeeDues.createdAt,
      organizerName: users.name,
      organizerEmail: users.email,
      eventTitle: events.title,
    })
    .from(organizerFeeDues)
    .leftJoin(users, eq(organizerFeeDues.organizerId, users.id))
    .leftJoin(events, eq(organizerFeeDues.eventId, events.id))
    .orderBy(desc(organizerFeeDues.createdAt))

  const filtered = active === "all" ? rows : rows.filter((r) => r.status === active)

  const [outstandingTotalRow] = await db
    .select({ total: sql<string>`COALESCE(SUM(${organizerFeeDues.feeAmount}), 0)` })
    .from(organizerFeeDues)
    .where(eq(organizerFeeDues.status, "outstanding"))
  const outstandingTotal = Number(outstandingTotalRow?.total ?? 0)

  const counts = new Map<string, number>()
  for (const r of rows) counts.set(r.status ?? "outstanding", (counts.get(r.status ?? "outstanding") ?? 0) + 1)

  return (
    <div className="tp-fade-up">
      <PageHeader
        eyebrow="Payouts"
        title="Organizer fee dues"
        subtitle="Platform fees owed to us for sales where the organizer was paid directly and we only issued the ticket."
        width="lg"
        actions={
          <Link
            href="/admin/orders/new"
            className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2.5 text-[13px] font-semibold text-white shadow-sm shadow-brand-600/20 hover:bg-brand-700 active:scale-[0.99] transition"
          >
            <CreditCard size={14} /> Issue a ticket
          </Link>
        }
      />

      <div className="px-5 md:px-8 py-8 md:py-10 space-y-6">
        <div className="rounded-2xl border border-line bg-paper p-5 flex items-center gap-4">
          <span className="inline-flex w-10 h-10 items-center justify-center rounded-xl bg-amber-50">
            <Clock size={16} className="text-amber-700" />
          </span>
          <div>
            <p className="text-[20px] font-bold text-ink tabular-nums">{formatCurrency(outstandingTotal, "USD")}</p>
            <p className="text-[12px] text-ink-2">Outstanding fees owed to the platform</p>
          </div>
        </div>

        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
          {TABS.map((t) => (
            <Link
              key={t.key}
              href={t.key === "outstanding" ? "/admin/organizer-fees" : `/admin/organizer-fees?status=${t.key}`}
              className={`rounded-lg px-3.5 py-2 text-[13px] whitespace-nowrap transition-colors ${
                active === t.key ? "bg-paper-2 text-ink font-semibold ring-1 ring-line" : "text-ink-2 hover:text-ink hover:bg-paper-2 font-medium"
              }`}
            >
              {t.label} {t.key !== "all" && counts.get(t.key) ? `(${counts.get(t.key)})` : ""}
            </Link>
          ))}
        </div>

        <div className="rounded-2xl border border-line bg-paper overflow-hidden">
          {filtered.length === 0 ? (
            <EmptyState icon={Ban} title="No fee dues in this view" body="Issue a ticket with 'Organizer did' selected to record one." />
          ) : (
            <ul className="divide-y divide-line">
              {filtered.map((r) => {
                const status = (r.status ?? "outstanding") as FeeDueStatus
                return (
                  <li key={r.id} className="px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[10px] font-semibold tracking-wide uppercase px-2 py-0.5 rounded-full ${STATUS_STYLE[status]}`}>
                          {STATUS_LABEL[status]}
                        </span>
                        <p className="text-[13px] font-semibold text-ink truncate">{r.organizerName ?? r.organizerEmail ?? "—"}</p>
                      </div>
                      <p className="text-[12px] text-ink-2 truncate">{r.eventTitle ?? "General"}</p>
                      <p className="text-[11px] text-ink-3 mt-0.5">
                        Gross {formatCurrency(Number(r.grossAmount), r.currency ?? "USD")} · {formatDateShort(r.createdAt)}
                        {status === "settled" && r.settledAt && ` · Settled ${formatDateShort(r.settledAt)} by ${r.settledBy ?? "—"}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <p className="text-[15px] font-bold text-amber-700 tabular-nums">{formatCurrency(Number(r.feeAmount), r.currency ?? "USD")}</p>
                      {status === "outstanding" && <MarkFeeDueSettledButton feeDueId={r.id} />}
                      {status === "settled" && <CheckCircle2 size={16} className="text-emerald-600" />}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
