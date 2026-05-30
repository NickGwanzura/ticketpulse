import Link from "next/link"
import { redirect } from "next/navigation"
import {
  CalendarCheck, FileText, XCircle, PackageCheck,
  Star, Calendar, Pencil, Image as ImageIcon, ShoppingBag, ExternalLink, Plus, Ticket, Send, EyeOff, Settings, HelpCircle, TrendingUp,
} from "lucide-react"
import { desc, eq, sql } from "drizzle-orm"

import { auth } from "@/auth"
import { db } from "@/db"
import { events, ticketTiers, orders, users } from "@/db/schema"
import PageHeader from "@/components/dashboard/PageHeader"
import EmptyState from "@/components/dashboard/EmptyState"
import Pagination from "@/components/ui/Pagination"
import { formatCurrency, formatDateShort } from "@/lib/utils"
import { publishEventAction } from "@/app/admin/actions/events"

type EventStatus = "draft" | "published" | "sold_out" | "cancelled" | "completed"

const STATUS_STYLE: Record<EventStatus, string> = {
  published: "bg-green-50 text-green-700",
  draft:     "bg-paper-2 text-ink-2 ring-1 ring-line",
  sold_out:  "bg-green-50 text-navy",
  cancelled: "bg-rose-50 text-rose-700",
  completed: "bg-paper-2 text-ink-3 ring-1 ring-line",
}

const STATUS_LABEL: Record<EventStatus, string> = {
  published: "Live",
  draft:     "Draft",
  sold_out:  "Sold out",
  cancelled: "Cancelled",
  completed: "Completed",
}

const TABS: { label: string; value: string }[] = [
  { label: "All",       value: "all" },
  { label: "Live",      value: "published" },
  { label: "Drafts",    value: "draft" },
  { label: "Sold out",  value: "sold_out" },
  { label: "Cancelled", value: "cancelled" },
]

const LIMIT = 25

export default async function AdminEventsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>
}) {
  const session = await auth()
  if (!session?.user || session.user.role !== "admin") {
    redirect("/auth/signin?callbackUrl=/admin/events")
  }

  const sp = await searchParams
  const activeTab = sp.status ?? "all"
  const currentPage = Math.max(1, parseInt(sp.page ?? "1", 10))
  const offset = (currentPage - 1) * LIMIT

  const eventRows = await db
    .select({
      id:           events.id,
      slug:         events.slug,
      title:        events.title,
      city:         events.city,
      startsAt:     events.startsAt,
      status:       events.status,
      featured:     events.featured,
      organizerId:  events.organizerId,
      organizerName:  users.name,
      organizerEmail: users.email,
      capacity:  sql<number>`COALESCE(SUM(${ticketTiers.totalQuantity}), 0)::int`,
      sold:      sql<number>`COALESCE(SUM(${ticketTiers.soldQuantity}), 0)::int`,
    })
    .from(events)
    .leftJoin(users, eq(events.organizerId, users.id))
    .leftJoin(ticketTiers, eq(ticketTiers.eventId, events.id))
    .groupBy(events.id, users.id)
    .orderBy(desc(events.createdAt))
    .limit(LIMIT)
    .offset(offset)

  const revenueRows = await db
    .select({
      eventId:  orders.eventId,
      currency: orders.currency,
      revenue:  sql<string>`SUM(${orders.totalAmount})`,
    })
    .from(orders)
    .where(eq(orders.status, "paid"))
    .groupBy(orders.eventId, orders.currency)

  const revenueByEvent = new Map<string, { revenue: number; currency: string }>()
  for (const r of revenueRows) {
    if (!r.eventId) continue
    const amount = Number(r.revenue ?? 0)
    const cur = r.currency ?? "USD"
    const existing = revenueByEvent.get(r.eventId)
    if (!existing || amount > existing.revenue) {
      revenueByEvent.set(r.eventId, { revenue: amount, currency: cur })
    }
  }

  // Count total for pagination (all events)
  const [countRow] = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(events)

  const totalCount = countRow?.count ?? 0
  const totalPages = Math.ceil(totalCount / LIMIT)

  const filtered = activeTab === "all"
    ? eventRows
    : eventRows.filter((e) => e.status === activeTab)

  // Stats from all events in DB, not just current page
  const allEventStats = await db
    .select({
      status: events.status,
      count: sql<number>`COUNT(*)::int`,
    })
    .from(events)
    .groupBy(events.status)

  const statsMap = new Map(allEventStats.map((s) => [s.status, s.count]))
  const stats = [
    { label: "Live",      value: statsMap.get("published") ?? 0, icon: CalendarCheck, tone: "text-brand-700", bg: "bg-brand-50" },
    { label: "Drafts",    value: statsMap.get("draft") ?? 0,     icon: FileText,      tone: "text-ink-2",       bg: "bg-paper-2" },
    { label: "Sold out",  value: statsMap.get("sold_out") ?? 0,  icon: PackageCheck,  tone: "text-navy",        bg: "bg-brand-50" },
    { label: "Cancelled", value: statsMap.get("cancelled") ?? 0, icon: XCircle,       tone: "text-rose-700",    bg: "bg-rose-50" },
  ]

  return (
    <div className="tp-fade-up">
      <PageHeader
        eyebrow="Events"
        title="Event moderation"
        subtitle="Approve publish requests, feature picks, and pause cancellations."
        width="full"
        actions={
          <Link
            href="/organizer/events/new"
            className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2.5 text-[13px] font-semibold text-white shadow-sm shadow-brand-600/20 hover:bg-brand-700 active:scale-[0.99] transition"
          >
            <Plus size={14} /> Create event
          </Link>
        }
      />

      <div className="px-5 md:px-8 py-8 md:py-10 space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 tp-fade-up-1">
          {stats.map(({ label, value, icon: Icon, tone, bg }) => (
            <div key={label} className="rounded-2xl border border-line bg-paper p-5 flex items-center gap-4 tp-lift">
              <span className={`inline-flex w-10 h-10 items-center justify-center rounded-xl ${bg}`}>
                <Icon size={16} className={tone} />
              </span>
              <div>
                <p className="text-[11.5px] text-ink-3 mb-0.5">{label}</p>
                <p className="text-[26px] md:text-[28px] font-bold tracking-tight text-ink leading-none tabular-nums">{value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar tp-fade-up-2">
          {TABS.map((t) => {
            const isActive = activeTab === t.value
            return (
              <Link
                key={t.value}
                href={t.value === "all" ? "/admin/events" : `/admin/events?status=${t.value}`}
                className={`rounded-lg px-3.5 py-2 text-[13px] whitespace-nowrap transition-colors ${
                  isActive ? "bg-paper-2 text-ink font-semibold ring-1 ring-line" : "text-ink-2 hover:text-ink hover:bg-paper-2 font-medium"
                }`}
              >
                {t.label}
              </Link>
            )
          })}
        </div>

        <div className="rounded-2xl border border-line bg-paper overflow-hidden tp-fade-up-3">
          {filtered.length > 0 ? (
            <>
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full min-w-[820px]">
                  <thead>
                    <tr className="border-b border-line text-[11px] font-semibold tracking-widest text-ink-3 uppercase">
                      <th className="text-left px-5 py-3 font-semibold">Event</th>
                      <th className="text-left px-3 py-3 font-semibold">Organizer</th>
                      <th className="text-left px-3 py-3 font-semibold">Date</th>
                      <th className="text-left px-3 py-3 font-semibold">Status</th>
                      <th className="text-center px-3 py-3 font-semibold">Featured</th>
                      <th className="text-right px-3 py-3 font-semibold">Sold</th>
                      <th className="text-right px-3 py-3 font-semibold">Revenue</th>
                      <th className="px-3 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {filtered.map((e) => {
                      const status = (e.status ?? "draft") as EventStatus
                      const capacity = e.capacity ?? 0
                      const sold = e.sold ?? 0
                      const pct = capacity > 0 ? Math.min(100, Math.round((sold / capacity) * 100)) : 0
                      const rev = revenueByEvent.get(e.id)
                      const organizer = e.organizerName ?? e.organizerEmail ?? "—"
                      return (
                        <tr key={e.id} className="hover:bg-paper-2 transition-colors">
                          <td className="px-5 py-3.5 max-w-xs">
                            <Link href={`/events/${e.slug}`} className="block">
                              <p className="text-[13.5px] font-semibold tracking-tight text-ink line-clamp-1 hover:text-navy transition-colors">{e.title}</p>
                              <p className="text-[11.5px] text-ink-3 mt-0.5">{e.city}</p>
                            </Link>
                          </td>
                          <td className="px-3 py-3.5 text-[12.5px] text-ink-2 max-w-[180px] truncate">{organizer}</td>
                          <td className="px-3 py-3.5 text-[12.5px] text-ink-2 whitespace-nowrap">{formatDateShort(e.startsAt)}</td>
                          <td className="px-3 py-3.5">
                            <span className={`text-[10.5px] font-semibold tracking-wide uppercase px-2 py-1 rounded-full ${STATUS_STYLE[status]}`}>
                              {STATUS_LABEL[status]}
                            </span>
                          </td>
                          <td className="px-3 py-3.5">
                            <div className="flex items-center justify-center">
                              {e.featured ? (
                                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700">
                                  <Star size={11} className="fill-amber-400 text-amber-500" /> Yes
                                </span>
                              ) : (
                                <span className="text-[11px] text-ink-3">—</span>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-3.5 text-right whitespace-nowrap">
                            <p className="text-[12.5px] font-semibold text-ink">
                              {sold.toLocaleString()} <span className="text-ink-3 font-normal">/ {capacity.toLocaleString()}</span>
                            </p>
                            <div className="w-20 h-1 bg-paper-2 rounded-full mt-1 ml-auto overflow-hidden">
                              <div className="h-full bg-navy" style={{ width: `${pct}%` }} />
                            </div>
                          </td>
                          <td className="px-3 py-3.5 text-right text-[13px] font-bold tracking-tight text-ink whitespace-nowrap">
                            {rev ? formatCurrency(rev.revenue, rev.currency) : <span className="text-ink-3 font-normal">—</span>}
                          </td>
                          <td className="px-3 py-3.5">
                            <div className="flex items-center justify-end gap-1">
                              <Link
                                href={`/organizer/events/${e.id}`}
                                aria-label="Manage event"
                                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-navy hover:text-navy hover:bg-brand-50 transition-colors"
                              >
                                <Settings size={14} />
                              </Link>
                              <form
                                action={publishEventAction.bind(null, e.id)}
                              >
                                <button
                                  type="submit"
                                  aria-label={status === "published" ? "Unpublish" : "Publish"}
                                  className={`inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors ${
                                    status === "published"
                                      ? "text-amber-600 hover:text-amber-800 hover:bg-amber-50"
                                      : "text-brand-600 hover:text-green-800 hover:bg-brand-50"
                                  }`}
                                >
                                  {status === "published" ? <EyeOff size={14} /> : <Send size={14} />}
                                </button>
                              </form>
                              <Link
                                href={`/events/${e.slug}`}
                                aria-label="View public page"
                                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-ink-3 hover:text-ink hover:bg-paper-2 transition-colors"
                              >
                                <ExternalLink size={14} />
                              </Link>
                              <Link
                                href={`/organizer/events/${e.id}/edit`}
                                aria-label="Edit event"
                                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-ink-3 hover:text-ink hover:bg-paper-2 transition-colors"
                              >
                                <Pencil size={14} />
                              </Link>
                              <Link
                                href={`/organizer/events/${e.id}/tiers`}
                                aria-label="Ticket tiers"
                                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-ink-3 hover:text-ink hover:bg-paper-2 transition-colors"
                              >
                                <Ticket size={14} />
                              </Link>
                              <Link
                                href={`/organizer/events/${e.id}/questions`}
                                aria-label="Ticket questions"
                                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-ink-3 hover:text-ink hover:bg-paper-2 transition-colors"
                              >
                                <HelpCircle size={14} />
                              </Link>
                              <Link
                                href={`/organizer/events/${e.id}/funnel`}
                                aria-label="Sales funnel"
                                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-ink-3 hover:text-ink hover:bg-paper-2 transition-colors"
                              >
                                <TrendingUp size={14} />
                              </Link>
                              <Link
                                href={`/organizer/events/${e.id}/gallery`}
                                aria-label="Gallery"
                                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-ink-3 hover:text-ink hover:bg-paper-2 transition-colors"
                              >
                                <ImageIcon size={14} />
                              </Link>
                              <Link
                                href={`/organizer/events/${e.id}/merch`}
                                aria-label="Merch"
                                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-ink-3 hover:text-ink hover:bg-paper-2 transition-colors"
                              >
                                <ShoppingBag size={14} />
                              </Link>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              <ul className="md:hidden divide-y divide-line">
                {filtered.map((e) => {
                  const status = (e.status ?? "draft") as EventStatus
                  const capacity = e.capacity ?? 0
                  const sold = e.sold ?? 0
                  const pct = capacity > 0 ? Math.min(100, Math.round((sold / capacity) * 100)) : 0
                  const rev = revenueByEvent.get(e.id)
                  const organizer = e.organizerName ?? e.organizerEmail ?? "—"
                  return (
                    <li key={e.id} className="p-5">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className={`text-[10px] font-semibold tracking-wide uppercase px-2 py-0.5 rounded-full ${STATUS_STYLE[status]}`}>{STATUS_LABEL[status]}</span>
                            {e.featured && <Star size={11} className="text-amber-500 fill-amber-400" />}
                          </div>
                          <Link href={`/events/${e.slug}`} className="block">
                            <p className="text-[13.5px] font-semibold tracking-tight text-ink line-clamp-1">{e.title}</p>
                          </Link>
                          <p className="text-[11.5px] text-ink-3 mt-0.5 truncate">{organizer} · {e.city}</p>
                        </div>
                        <p className="text-[13px] font-bold tracking-tight text-ink whitespace-nowrap">
                          {rev ? formatCurrency(rev.revenue, rev.currency) : <span className="text-ink-3 font-normal">—</span>}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 mb-3">
                        <div className="flex-1 h-1 bg-paper-2 rounded-full overflow-hidden">
                          <div className="h-full bg-navy" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-[11px] text-ink-3 whitespace-nowrap tabular-nums">{sold}/{capacity}</span>
                      </div>
                      <div className="flex items-center gap-2 text-[12px]">
                        <Link
                          href={`/organizer/events/${e.id}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-green-50 text-navy hover:bg-green-100 transition-colors font-semibold"
                        >
                          <Settings size={12} /> Manage
                        </Link>
                        <form action={publishEventAction.bind(null, e.id)}>
                          <button
                            type="submit"
                            className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md transition-colors ${
                              status === "published"
                                ? "bg-amber-50 text-amber-700 hover:bg-amber-100"
                                : "bg-green-50 text-green-700 hover:bg-green-100"
                            }`}
                          >
                            {status === "published" ? <EyeOff size={12} /> : <Send size={12} />}
                            {status === "published" ? "Unpublish" : "Publish"}
                          </button>
                        </form>
                        <Link href={`/organizer/events/${e.id}/edit`} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-paper-2 text-ink-2 hover:text-ink transition-colors">
                          <Pencil size={12} /> Edit
                        </Link>
                        <Link href={`/organizer/events/${e.id}/tiers`} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-paper-2 text-ink-2 hover:text-ink transition-colors">
                          <Ticket size={12} /> Tickets
                        </Link>
                        <Link href={`/organizer/events/${e.id}/questions`} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-paper-2 text-ink-2 hover:text-ink transition-colors">
                          <HelpCircle size={12} /> Questions
                        </Link>
                        <Link href={`/organizer/events/${e.id}/funnel`} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-paper-2 text-ink-2 hover:text-ink transition-colors">
                          <TrendingUp size={12} /> Funnel
                        </Link>
                        <Link href={`/organizer/events/${e.id}/gallery`} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-paper-2 text-ink-2 hover:text-ink transition-colors">
                          <ImageIcon size={12} /> Gallery
                        </Link>
                        <Link href={`/organizer/events/${e.id}/merch`} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-paper-2 text-ink-2 hover:text-ink transition-colors">
                          <ShoppingBag size={12} /> Merch
                        </Link>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </>
          ) : (
            <EmptyState
              icon={Calendar}
              title={activeTab === "all" ? "No events yet" : `No events in "${TABS.find(t => t.value === activeTab)?.label ?? activeTab}"`}
              body={
                activeTab === "all"
                  ? "Published, draft, and pending events will appear here once organizers create them — or create one yourself."
                  : "Try a different tab, or check back as state changes."
              }
              ctaLabel={activeTab === "all" ? "Create event" : undefined}
              ctaHref={activeTab === "all" ? "/organizer/events/new" : undefined}
              variant="inline"
            />
          )}
          {eventRows.length > 0 && (
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              baseUrl="/admin/events"
              queryParams={{ status: activeTab !== "all" ? activeTab : undefined }}
            />
          )}
        </div>
      </div>
    </div>
  )
}
