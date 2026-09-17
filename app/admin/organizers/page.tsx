import Link from "next/link"
import { redirect } from "next/navigation"
import {
  ArrowUpRight,
  BadgeCheck,
  BadgeX,
  CalendarDays,
  Clock3,
  Mail,
  MessageCircle,
  Phone,
  Search,
  UsersRound,
  UserRoundPlus,
  Snowflake,
  Unlock,
} from "lucide-react"
import { and, asc, desc, eq, ilike, isNotNull, isNull, or, sql } from "drizzle-orm"

import { auth } from "@/auth"
import { db } from "@/db"
import { events, users } from "@/db/schema"
import { approveOrganizerAction, freezeOrganizerWithoutEventsAction, unfreezeOrganizerAction } from "@/app/admin/actions/users"
import EmptyState from "@/components/dashboard/EmptyState"
import PageHeader from "@/components/dashboard/PageHeader"
import Pagination from "@/components/ui/Pagination"

const LIMIT = 25
const NEW_DAYS = 14
const NO_EVENT_DAYS = 14
const STATUS_FILTERS = ["all", "no_event", "stalled", "frozen", "new", "pending", "approved"] as const
type StatusFilter = (typeof STATUS_FILTERS)[number]

function phoneHref(phone: string): string {
  return `tel:${phone.replace(/[^+\d]/g, "")}`
}

function whatsappHref(phone: string, name: string | null): string {
  const digits = phone.replace(/\D/g, "").replace(/^0/, "263")
  const text = `Hi ${name?.split(" ")[0] ?? "there"}, this is TicketPulse. We are following up on your organiser account.`
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`
}

function onboardingEmailHref(email: string, name: string | null): string {
  const subject = "Need help creating your first TicketPulse event"
  const body = `Hi ${name ?? "there"},\n\nWe noticed you have an approved TicketPulse organizer account but no event created yet. We can help you get your first event live.\n\nCreate an event: https://ticketpulse.tech/organizer/events/new`
  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}

export default async function AdminOrganizersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>
}) {
  const session = await auth()
  if (!session?.user || session.user.role !== "admin") {
    redirect("/auth/signin?callbackUrl=/admin/organizers")
  }

  const params = await searchParams
  const searchQuery = params.q?.trim() ?? ""
  const requestedStatus = params.status?.trim() ?? "all"
  const status: StatusFilter = STATUS_FILTERS.includes(requestedStatus as StatusFilter)
    ? requestedStatus as StatusFilter
    : "all"
  const currentPage = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1)
  const offset = (currentPage - 1) * LIMIT

  const conditions = [eq(users.role, "organizer")]
  const noEventCondition = sql`NOT EXISTS (
    SELECT 1 FROM events e_without_event
    WHERE e_without_event.organizer_id::text = ${users.id}::text
  )`
  if (searchQuery) {
    conditions.push(or(
      ilike(users.name, `%${searchQuery}%`),
      ilike(users.email, `%${searchQuery}%`),
      ilike(users.phone, `%${searchQuery}%`),
    )!)
  }
  if (status === "new") conditions.push(sql`${users.createdAt} >= NOW() - INTERVAL '${sql.raw(String(NEW_DAYS))} days'`)
  if (status === "no_event") conditions.push(noEventCondition)
  if (status === "stalled") conditions.push(and(
    sql`${users.createdAt} < NOW() - INTERVAL '${sql.raw(String(NO_EVENT_DAYS))} days'`,
    noEventCondition,
  )!)
  if (status === "frozen") conditions.push(isNotNull(users.organizerFrozenAt))
  if (status === "pending") conditions.push(isNull(users.approvedAt))
  if (status === "approved") conditions.push(isNotNull(users.approvedAt))
  const whereClause = and(...conditions)

  const [organizers, [countRow], [stats]] = await Promise.all([
    db.select({
      id: users.id,
      name: users.name,
      email: users.email,
      phone: users.phone,
      emailVerified: users.emailVerified,
      approvedAt: users.approvedAt,
      organizerFrozenAt: users.organizerFrozenAt,
      organizerFreezeReason: users.organizerFreezeReason,
      createdAt: users.createdAt,
      organizerSlug: users.organizerSlug,
      eventCount: sql<number>`COUNT(${events.id})::int`,
      lastEventCreatedAt: sql<Date | null>`MAX(${events.createdAt})`,
      lastEventTitle: sql<string | null>`(
        array_agg(${events.title} ORDER BY ${events.createdAt} DESC)
        FILTER (WHERE ${events.id} IS NOT NULL)
      )[1]`,
      lastEventStatus: sql<string | null>`(
        array_agg(${events.status} ORDER BY ${events.createdAt} DESC)
        FILTER (WHERE ${events.id} IS NOT NULL)
      )[1]`,
      daysRegistered: sql<number>`GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (NOW() - ${users.createdAt})) / 86400))::int`,
      isNew: sql<boolean>`${users.createdAt} >= NOW() - INTERVAL '${sql.raw(String(NEW_DAYS))} days'`,
    })
      .from(users)
      .leftJoin(events, sql`${events.organizerId}::text = ${users.id}::text`)
      .where(whereClause)
      .groupBy(users.id)
      .orderBy(status === "no_event" || status === "stalled" ? asc(users.createdAt) : desc(users.createdAt))
      .limit(LIMIT)
      .offset(offset),
    db.select({ count: sql<number>`COUNT(*)::int` }).from(users).where(whereClause),
    db.select({
      total: sql<number>`COUNT(*)::int`,
      newCount: sql<number>`COUNT(*) FILTER (WHERE ${users.createdAt} >= NOW() - INTERVAL '${sql.raw(String(NEW_DAYS))} days')::int`,
      pending: sql<number>`COUNT(*) FILTER (WHERE ${users.approvedAt} IS NULL)::int`,
      contactable: sql<number>`COUNT(*) FILTER (WHERE NULLIF(TRIM(${users.phone}), '') IS NOT NULL OR NULLIF(TRIM(${users.email}), '') IS NOT NULL)::int`,
      noEvent: sql<number>`COUNT(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM events e_without_event WHERE e_without_event.organizer_id::text = ${users.id}::text))::int`,
      stalled: sql<number>`COUNT(*) FILTER (WHERE ${users.createdAt} < NOW() - INTERVAL '${sql.raw(String(NO_EVENT_DAYS))} days' AND NOT EXISTS (SELECT 1 FROM events e_stalled WHERE e_stalled.organizer_id::text = ${users.id}::text))::int`,
      frozen: sql<number>`COUNT(*) FILTER (WHERE ${users.organizerFrozenAt} IS NOT NULL)::int`,
      missingPhone: sql<number>`COUNT(*) FILTER (WHERE NULLIF(TRIM(${users.phone}), '') IS NULL)::int`,
    }).from(users).where(eq(users.role, "organizer")),
  ])

  const totalPages = Math.max(1, Math.ceil((countRow?.count ?? 0) / LIMIT))
  const statCards = [
    { label: "All organizers", value: stats?.total ?? 0, icon: UsersRound, tone: "text-sky-700", bg: "bg-sky-50" },
    { label: "No event created", value: stats?.noEvent ?? 0, icon: UserRoundPlus, tone: "text-rose-700", bg: "bg-rose-50" },
    { label: `${NO_EVENT_DAYS}+ days, no event`, value: stats?.stalled ?? 0, icon: Clock3, tone: "text-violet-700", bg: "bg-violet-50" },
    { label: "Frozen", value: stats?.frozen ?? 0, icon: Snowflake, tone: "text-sky-700", bg: "bg-sky-50" },
    { label: "Pending approval", value: stats?.pending ?? 0, icon: BadgeX, tone: "text-amber-700", bg: "bg-amber-50" },
    { label: "Missing phone", value: stats?.missingPhone ?? 0, icon: Phone, tone: "text-amber-700", bg: "bg-amber-50" },
  ]

  const filterHref = (nextStatus: StatusFilter) => {
    const query = new URLSearchParams()
    if (searchQuery) query.set("q", searchQuery)
    if (nextStatus !== "all") query.set("status", nextStatus)
    const suffix = query.toString()
    return `/admin/organizers${suffix ? `?${suffix}` : ""}`
  }

  return (
    <div className="tp-fade-up">
      <PageHeader
        eyebrow="Organizers"
        title="Organizer contacts"
        subtitle="Newest registrations first, with direct email and phone actions for onboarding follow-up."
        width="full"
      />

      <div className="px-5 md:px-8 py-8 md:py-10 space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 md:gap-4">
          {statCards.map(({ label, value, icon: Icon, tone, bg }) => (
            <div key={label} className="rounded-2xl border border-line bg-paper p-5">
              <div className="flex items-center gap-2 mb-2.5">
                <span className={`inline-flex w-7 h-7 items-center justify-center rounded-lg ${bg}`}><Icon size={13} className={tone} /></span>
                <span className="text-[12px] text-ink-3">{label}</span>
              </div>
              <p className="text-[28px] font-bold tracking-tight text-ink leading-none tabular-nums">{value.toLocaleString()}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-col md:flex-row md:items-center gap-3">
          <form action="/admin/organizers" method="get" className="relative flex-1 max-w-md">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3" />
            <input
              name="q"
              defaultValue={searchQuery}
              placeholder="Search name, email, or phone"
              className="w-full rounded-xl border border-line bg-paper pl-9 pr-3 py-2.5 text-[13px] text-ink placeholder:text-ink-3 focus:outline-none focus:border-line-2 focus:ring-4 focus:ring-brand-500/10"
            />
            {status !== "all" && <input type="hidden" name="status" value={status} />}
          </form>
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {STATUS_FILTERS.map((item) => (
              <Link
                key={item}
                href={filterHref(item)}
                className={`rounded-lg px-3.5 py-1.5 text-[13px] whitespace-nowrap capitalize transition-colors ${status === item ? "bg-paper text-ink font-semibold ring-1 ring-line" : "text-ink-2 hover:text-ink hover:bg-paper"}`}
              >
                {item === "new"
                  ? `New ${NEW_DAYS}d`
                  : item === "no_event"
                    ? "No event"
                    : item === "stalled"
                      ? `Stalled ${NO_EVENT_DAYS}d+`
                      : item === "frozen"
                        ? "Frozen"
                      : item}
              </Link>
            ))}
          </div>
        </div>

        {organizers.length === 0 ? (
          <EmptyState icon={UsersRound} title="No organizers found" body="Try changing the search or status filter." variant="inline" />
        ) : (
          <div className="rounded-2xl border border-line bg-paper overflow-hidden">
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full min-w-[1000px]">
                <thead>
                  <tr className="border-b border-line bg-paper-2 text-[11px] font-semibold tracking-widest text-ink-3 uppercase">
                    <th className="text-left px-5 py-3">Organizer</th>
                    <th className="text-left px-3 py-3">Phone</th>
                    <th className="text-left px-3 py-3">Registered</th>
                    <th className="text-left px-3 py-3">Approval</th>
                    <th className="text-left px-3 py-3">Activity</th>
                    <th className="text-right px-5 py-3">Contact</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {organizers.map((organizer) => {
                    return (
                      <tr key={organizer.id} className="hover:bg-paper-2 transition-colors">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-[14px] font-semibold text-ink">{organizer.name ?? "Unnamed organizer"}</p>
                            {organizer.isNew && <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-700">New</span>}
                          </div>
                          <p className="text-[12px] text-ink-3 mt-0.5">{organizer.email ?? "No email"}</p>
                        </td>
                        <td className="px-3 py-4 text-[13px] text-ink-2">{organizer.phone ?? "No phone"}</td>
                        <td className="px-3 py-4 text-[12px] text-ink-2 whitespace-nowrap">
                          {organizer.createdAt ? organizer.createdAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—"}
                          <p className="text-[11px] text-ink-3 mt-1">
                            {organizer.daysRegistered === 0 ? "Joined today" : `${organizer.daysRegistered}d registered`}
                          </p>
                          <p className="text-[11px] text-ink-3 mt-0.5">{organizer.emailVerified ? "Email verified" : "Email unverified"}</p>
                        </td>
                        <td className="px-3 py-4">
                          {organizer.organizerFrozenAt ? (
                            <span className="inline-flex items-center gap-1 text-[12px] font-medium text-sky-700"><Snowflake size={13} /> Frozen</span>
                          ) : organizer.approvedAt ? (
                            <span className="inline-flex items-center gap-1 text-[12px] font-medium text-emerald-700"><BadgeCheck size={13} /> Approved</span>
                          ) : (
                            <form action={approveOrganizerAction.bind(null, organizer.id)}>
                              <button type="submit" className="inline-flex items-center gap-1 text-[12px] font-medium text-amber-700 hover:underline"><BadgeX size={13} /> Pending — approve</button>
                            </form>
                          )}
                        </td>
                        <td className="px-3 py-4 text-[12px] text-ink-2">
                          {organizer.eventCount === 0 ? (
                            <div className="space-y-1">
                              <span className="inline-flex items-center gap-1 font-semibold text-rose-700"><CalendarDays size={12} /> No event created</span>
                              <p className="text-[11px] text-ink-3">Needs onboarding follow-up</p>
                            </div>
                          ) : (
                            <div className="space-y-1">
                              <span className="inline-flex items-center gap-1"><CalendarDays size={12} /> {organizer.eventCount} event{organizer.eventCount === 1 ? "" : "s"}</span>
                              <p className="text-[11px] text-ink-3 truncate max-w-[220px]" title={organizer.lastEventTitle ?? undefined}>
                                Last: {organizer.lastEventTitle ?? "Unknown"}
                              </p>
                              <p className="text-[11px] text-ink-3">
                                {organizer.lastEventCreatedAt ? `Created ${organizer.lastEventCreatedAt.toLocaleDateString("en-GB")}` : "Date unknown"}
                                {organizer.lastEventStatus ? ` · ${organizer.lastEventStatus.replace("_", " ")}` : ""}
                              </p>
                            </div>
                          )}
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center justify-end gap-1.5">
                            {organizer.email && <a href={onboardingEmailHref(organizer.email, organizer.name)} title={`Email ${organizer.email}`} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-sky-50 text-[12px] font-medium text-sky-700 hover:bg-sky-100"><Mail size={12} /> Email</a>}
                            {organizer.phone && <a href={phoneHref(organizer.phone)} title={`Call ${organizer.phone}`} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-50 text-[12px] font-medium text-emerald-700 hover:bg-emerald-100"><Phone size={12} /> Call</a>}
                            {organizer.phone && <a href={whatsappHref(organizer.phone, organizer.name)} target="_blank" rel="noreferrer" title={`Message ${organizer.phone} on WhatsApp`} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-green-50 text-[12px] font-medium text-green-700 hover:bg-green-100"><MessageCircle size={12} /> WhatsApp</a>}
                            {organizer.organizerSlug && <Link href={`/o/${organizer.organizerSlug}`} className="inline-flex w-8 h-8 items-center justify-center rounded-lg bg-paper-2 text-ink-2 hover:text-navy" title="View public organizer page"><ArrowUpRight size={13} /></Link>}
                            {organizer.eventCount === 0 && (organizer.organizerFrozenAt ? (
                              <form action={unfreezeOrganizerAction.bind(null, organizer.id)}>
                                <button type="submit" title="Unfreeze organizer" className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-sky-50 text-[12px] font-medium text-sky-700 hover:bg-sky-100"><Unlock size={12} /> Unfreeze</button>
                              </form>
                            ) : (
                              <form action={freezeOrganizerWithoutEventsAction.bind(null, organizer.id)}>
                                <button type="submit" title="Freeze organizer with no event" className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 text-[12px] font-medium text-slate-700 hover:bg-slate-200"><Snowflake size={12} /> Freeze</button>
                              </form>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <ul className="md:hidden divide-y divide-line">
              {organizers.map((organizer) => (
                <li key={organizer.id} className="p-5 space-y-3">
                  <div>
                    <p className="text-[14px] font-semibold text-ink">{organizer.name ?? "Unnamed organizer"}</p>
                    <p className="text-[12px] text-ink-3">{organizer.email ?? "No email"}</p>
                    <p className="text-[12px] text-ink-3">{organizer.phone ?? "No phone"}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-ink-2">
                    <span>{organizer.createdAt ? `Joined ${organizer.createdAt.toLocaleDateString("en-GB")}` : "Join date unknown"}</span>
                    <span>·</span><span>{organizer.eventCount === 0 ? "No event yet" : `${organizer.eventCount} event${organizer.eventCount === 1 ? "" : "s"}`}</span>
                    <span>·</span><span>{organizer.daysRegistered}d registered</span>
                    <span>·</span><span>{organizer.organizerFrozenAt ? "Frozen" : organizer.approvedAt ? "Approved" : "Pending approval"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {organizer.email && <a href={onboardingEmailHref(organizer.email, organizer.name)} className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-sky-50 text-[12px] font-medium text-sky-700"><Mail size={12} /> Email</a>}
                    {organizer.phone && <a href={phoneHref(organizer.phone)} className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-emerald-50 text-[12px] font-medium text-emerald-700"><Phone size={12} /> Call</a>}
                    {organizer.phone && <a href={whatsappHref(organizer.phone, organizer.name)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-green-50 text-[12px] font-medium text-green-700"><MessageCircle size={12} /> WhatsApp</a>}
                    {organizer.eventCount === 0 && (organizer.organizerFrozenAt ? (
                      <form action={unfreezeOrganizerAction.bind(null, organizer.id)}>
                        <button type="submit" className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-sky-50 text-[12px] font-medium text-sky-700"><Unlock size={12} /> Unfreeze</button>
                      </form>
                    ) : (
                      <form action={freezeOrganizerWithoutEventsAction.bind(null, organizer.id)}>
                        <button type="submit" className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-slate-100 text-[12px] font-medium text-slate-700"><Snowflake size={12} /> Freeze</button>
                      </form>
                    ))}
                  </div>
                </li>
              ))}
            </ul>

            <Pagination currentPage={currentPage} totalPages={totalPages} baseUrl="/admin/organizers" queryParams={{ q: searchQuery || undefined, status: status === "all" ? undefined : status }} />
          </div>
        )}
      </div>
    </div>
  )
}
