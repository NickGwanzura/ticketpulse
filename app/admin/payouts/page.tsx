import Link from "next/link"
import { redirect } from "next/navigation"
import {
  Wallet, Clock, CheckCircle2, Send,
  Smartphone, Building2, Inbox, XCircle, Banknote,
} from "lucide-react"
import { desc, eq, isNotNull, or, sql } from "drizzle-orm"
import { auth } from "@/auth"
import PageHeader from "@/components/dashboard/PageHeader"
import EmptyState from "@/components/dashboard/EmptyState"
import { db } from "@/db"
import { events, users } from "@/db/schema"
import { formatCurrency, formatDateShort } from "@/lib/utils"
import {
  getPayouts, approvePayoutAction, rejectPayoutAction,
  markPayoutPaidAction, markPayoutProcessingAction,
} from "./actions"
import ManualPayoutForm from "./ManualPayoutForm"
import Badge from "@/components/ui/Badge"
import PayoutsTable, { STATUS_LABEL, STATUS_TONE, payoutMethodLabel, type PayoutStatus } from "./PayoutsTable"

const TABS: { key: PayoutStatus | "all"; label: string }[] = [
  { key: "pending",   label: "Pending" },
  { key: "approved",  label: "Approved" },
  { key: "processing", label: "Processing" },
  { key: "paid",      label: "Paid" },
  { key: "held",      label: "Held" },
  { key: "rejected",  label: "Rejected" },
]

export default async function AdminPayoutsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const session = await auth()
  if (!session?.user || session.user.role !== "admin") {
    redirect("/auth/signin")
  }

  const params = await searchParams
  const active = (params.status as PayoutStatus | "all" | undefined) ?? "pending"

  // Wrap data fetching so a single failed query degrades gracefully
  // instead of blanking the entire admin page.
  let payoutRows: Awaited<ReturnType<typeof getPayouts>>["payouts"] = []
  let stats = { pending: 0, approved: 0, processing: 0, paid: 0, held: 0, rejected: 0, failed: 0, cancelled: 0, pendingTotal: 0 }
  let organizerRows: { id: string; name: string | null; email: string | null }[] = []
  let eventRows: { id: string; title: string; organizerId: string }[] = []

  try {
    const result = await getPayouts(active === "all" ? undefined : active)
    payoutRows = result.payouts
    stats = result.stats
  } catch (err) {
    console.error("[admin/payouts] Failed to load payouts:", err)
  }

  try {
    const [orgs, evts] = await Promise.all([
      db
        .selectDistinct({ id: users.id, name: users.name, email: users.email })
        .from(users)
        .leftJoin(events, sql`${events.organizerId}::text = ${users.id}::text`)
        .where(or(eq(users.role, "organizer"), isNotNull(events.id)))
        .orderBy(users.name),
      db
        .select({ id: events.id, title: events.title, organizerId: events.organizerId })
        .from(events)
        .orderBy(desc(events.startsAt))
        .limit(200),
    ])
    organizerRows = orgs
    eventRows = evts
  } catch (err) {
    console.error("[admin/payouts] Failed to load organizers/events:", err)
  }

  const statsCards = [
    { label: "Pending",     value: stats.pending,     icon: Clock,          tone: "text-amber-700",  bg: "bg-amber-50" },
    { label: "Approved",    value: stats.approved,    icon: CheckCircle2,   tone: "text-violet-700", bg: "bg-violet-50" },
    { label: "Processing",  value: stats.processing,  icon: Send,           tone: "text-sky-700",    bg: "bg-sky-50" },
    { label: "Paid",        value: stats.paid,        icon: CheckCircle2,   tone: "text-emerald-700", bg: "bg-emerald-50" },
    { label: "Rejected",    value: stats.rejected,    icon: XCircle,        tone: "text-red-700",    bg: "bg-red-50" },
  ]

  const pendingTotal = Number(stats.pendingTotal ?? 0)

  return (
    <div className="tp-fade-up">
      <PageHeader
        eyebrow="Payouts"
        title="Organizer payouts"
        subtitle="Review, approve, and process organizer EcoCash and bank settlement requests."
        width="full"
      />

      <div className="px-5 md:px-8 py-8 md:py-10 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 md:gap-4 tp-fade-up-1">
          {statsCards.map(({ label, value, icon: Icon, tone, bg }) => (
            <div key={label} className="rounded-2xl border border-line bg-paper p-5 flex items-center gap-4 tp-lift">
              <span className={`inline-flex w-10 h-10 items-center justify-center rounded-xl ${bg}`}>
                <Icon size={16} className={tone} />
              </span>
              <div>
                <p className="text-[12px] text-ink-3 mb-0.5">{label}</p>
                <p className="text-[26px] md:text-[28px] font-bold tracking-tight text-ink leading-none tabular-nums">{value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* CTA banner */}
        {pendingTotal > 0 && (
          <div className="rounded-2xl border border-brand-500/15 bg-brand-50/60 px-5 md:px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 tp-fade-up-2">
            <div className="flex items-start gap-3">
              <span className="inline-flex w-9 h-9 items-center justify-center rounded-lg bg-paper ring-1 ring-line shrink-0">
                <Wallet size={15} className="text-brand-600" />
              </span>
              <div>
                <p className="text-[14px] font-semibold tracking-tight text-ink">{formatCurrency(pendingTotal, "USD")} ready to review</p>
                <p className="text-[13px] text-ink-2">{stats.pending} payout request{stats.pending !== 1 ? "s" : ""} pending approval.</p>
              </div>
            </div>
            <Link
              href="/admin/payouts?status=pending"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-[14px] font-semibold text-white shadow-sm shadow-brand-600/20 hover:bg-brand-700 transition-colors"
            >
              <Send size={13} /> Review pending
            </Link>
          </div>
        )}

        {/* Record manual payout */}
        <div className="rounded-2xl border border-line bg-paper p-5">
          <div className="mb-4 flex items-center gap-2">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50">
              <Banknote size={15} className="text-emerald-700" />
            </span>
            <div>
              <p className="text-[14px] font-bold tracking-tight text-ink">Record manual payout</p>
              <p className="text-[12px] text-ink-3">Already paid an organiser outside the app (cash, manual EcoCash, or direct transfer)? Record it here so balances and reconciliation stay accurate.</p>
            </div>
          </div>
          <ManualPayoutForm organizers={organizerRows} events={eventRows} />
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
          {TABS.map(({ key, label }) => {
            const isActive = active === key
            const count = key === "pending" ? stats.pending
              : key === "approved" ? stats.approved
              : key === "processing" ? stats.processing
              : key === "paid" ? stats.paid
              : key === "held" ? stats.held
              : key === "rejected" ? stats.rejected
              : 0
            return (
              <Link
                key={key}
                href={`/admin/payouts?status=${key}`}
                className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-[13px] whitespace-nowrap transition-colors ${
                  isActive ? "bg-paper-2 text-ink font-semibold ring-1 ring-line" : "text-ink-2 hover:text-ink hover:bg-paper-2 font-medium"
                }`}
              >
                {label}
                <span className={`inline-flex items-center justify-center min-w-[20px] h-[20px] rounded-full px-1 text-[11px] font-bold ${
                  isActive ? "bg-navy text-white" : "bg-paper-2 text-ink-3 ring-1 ring-line"
                }`}>{count}</span>
              </Link>
            )
          })}
        </div>

        {/* Table */}
        <div className="rounded-2xl border border-line bg-paper overflow-hidden tp-fade-up-3">
          {payoutRows.length > 0 ? (
            <>
              <div className="hidden md:block p-3">
                <PayoutsTable rows={payoutRows} exportFilename={`payouts-${active}`} />
              </div>

              {/* Mobile cards */}
              <ul className="md:hidden divide-y divide-line">
                {payoutRows.map((p) => (
                  <li key={p.id} className="p-5">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="min-w-0">
                        <p className="text-[14px] font-semibold tracking-tight text-ink truncate">{p.organizerName ?? "—"}</p>
                        <p className="text-[12px] text-ink-3 mt-0.5 line-clamp-1">{p.eventTitle ?? "General"}</p>
                      </div>
                      <Badge tone={STATUS_TONE[p.status as PayoutStatus]} className="text-[10px] px-2 py-0.5">{STATUS_LABEL[p.status as PayoutStatus]}</Badge>
                    </div>
                    <div className="flex items-center justify-between gap-3 text-[13px]">
                      <span className="inline-flex items-center gap-1.5 text-ink-2">
                        {p.method === "cash" ? <Banknote size={12} className="text-emerald-700" /> : p.method === "ecocash" ? <Smartphone size={12} className="text-emerald-700" /> : <Building2 size={12} className="text-sky-700" />}
                        {payoutMethodLabel(p)} · {p.createdAt ? formatDateShort(new Date(p.createdAt)) : "—"}
                      </span>
                      <span className="text-[14px] font-bold tracking-tight text-ink">
                        {formatCurrency(Number(p.amount), p.currency)}
                      </span>
                    </div>
                    <p className="mt-2 text-[11px] text-ink-3 leading-4">
                      {p.method === "cash"
                        ? p.proofReference
                        : p.method === "ecocash"
                        ? p.accountNumber
                        : [p.bankName, p.accountName, p.accountNumber].filter(Boolean).join(" · ")}
                    </p>

                    {/* Mobile action buttons */}
                    {p.status === "pending" && (
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <form action={async () => { "use server"; await approvePayoutAction(p.id) }}>
                          <button type="submit" className="inline-flex items-center gap-1 rounded-lg bg-violet-600 px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-violet-700">Approve</button>
                        </form>
                        <form action={async (formData: FormData) => { "use server"; const reason = formData.get("reason") as string; await rejectPayoutAction(p.id, reason) }}>
                          <input name="reason" type="text" placeholder="Reason..." required minLength={5} className="w-24 rounded-lg border border-line bg-paper px-2 py-1.5 text-[11px]" />
                          <button type="submit" className="ml-1 inline-flex items-center gap-1 rounded-lg bg-red-600 px-2.5 py-1.5 text-[11px] font-semibold text-white">Reject</button>
                        </form>
                      </div>
                    )}
                    {p.status === "approved" && (
                      <div className="mt-3 flex items-center gap-2">
                        <form action={async () => { "use server"; await markPayoutProcessingAction(p.id) }}>
                          <button type="submit" className="inline-flex items-center gap-1 rounded-lg bg-sky-600 px-2.5 py-1.5 text-[11px] font-semibold text-white">Process</button>
                        </form>
                        <form action={async (formData: FormData) => { "use server"; const ref = formData.get("proofRef") as string; await markPayoutPaidAction(p.id, ref || undefined) }}>
                          <input name="proofRef" type="text" required minLength={3} aria-label="Transfer or receipt reference" placeholder="Proof ref" className="w-20 rounded-lg border border-line bg-paper px-2 py-1.5 text-[11px]" />
                          <button type="submit" className="ml-1 inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-[11px] font-semibold text-white">Pay</button>
                        </form>
                      </div>
                    )}
                    {p.status === "processing" && (
                      <div className="mt-3">
                        <form action={async (formData: FormData) => { "use server"; const ref = formData.get("proofRef") as string; await markPayoutPaidAction(p.id, ref || undefined) }}>
                          <div className="flex items-center gap-1">
                            <input name="proofRef" type="text" required minLength={3} aria-label="Transfer or receipt reference" placeholder="Proof ref" className="w-24 rounded-lg border border-line bg-paper px-2 py-1.5 text-[11px]" />
                            <button type="submit" className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-[11px] font-semibold text-white">Mark paid</button>
                          </div>
                        </form>
                      </div>
                    )}
                    {p.status === "rejected" && p.rejectionReason && (
                      <p className="mt-2 text-[11px] text-red-600">{p.rejectionReason}</p>
                    )}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <EmptyState
              icon={Inbox}
              title="No payouts in this status"
              body="When payouts are submitted, processed, or completed they'll appear here."
              variant="inline"
            />
          )}
        </div>
      </div>
    </div>
  )
}
