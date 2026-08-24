import Link from "next/link"
import { redirect } from "next/navigation"
import {
  ArrowUpRight,
  BadgeCheck,
  BadgeX,
  CalendarDays,
  Clock3,
  Mail,
  Phone,
  Search,
  UsersRound,
} from "lucide-react"
import { and, desc, eq, ilike, isNotNull, isNull, or, sql } from "drizzle-orm"

import { auth } from "@/auth"
import { db } from "@/db"
import { events, users } from "@/db/schema"
import { approveOrganizerAction } from "@/app/admin/actions/users"
import EmptyState from "@/components/dashboard/EmptyState"
import PageHeader from "@/components/dashboard/PageHeader"
import Pagination from "@/components/ui/Pagination"

const LIMIT = 25
const NEW_DAYS = 14
const STATUS_FILTERS = ["all", "new", "pending", "approved"] as const
type StatusFilter = (typeof STATUS_FILTERS)[number]

function phoneHref(phone: string): string {
  return `tel:${phone.replace(/[^+\d]/g, "")}`
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
  if (searchQuery) {
    conditions.push(or(
      ilike(users.name, `%${searchQuery}%`),
      ilike(users.email, `%${searchQuery}%`),
      ilike(users.phone, `%${searchQuery}%`),
    )!)
  }
  if (status === "new") conditions.push(sql`${users.createdAt} >= NOW() - INTERVAL '${sql.raw(String(NEW_DAYS))} days'`)
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
      createdAt: users.createdAt,
      organizerSlug: users.organizerSlug,
      eventCount: sql<number>`COUNT(${events.id})::int`,
      isNew: sql<boolean>`${users.createdAt} >= NOW() - INTERVAL '${sql.raw(String(NEW_DAYS))} days'`,
    })
      .from(users)
      .leftJoin(events, eq(events.organizerId, users.id))
      .where(whereClause)
      .groupBy(users.id)
      .orderBy(desc(users.createdAt))
      .limit(LIMIT)
      .offset(offset),
    db.select({ count: sql<number>`COUNT(*)::int` }).from(users).where(whereClause),
    db.select({
      total: sql<number>`COUNT(*)::int`,
      newCount: sql<number>`COUNT(*) FILTER (WHERE ${users.createdAt} >= NOW() - INTERVAL '${sql.raw(String(NEW_DAYS))} days')::int`,
      pending: sql<number>`COUNT(*) FILTER (WHERE ${users.approvedAt} IS NULL)::int`,
      contactable: sql<number>`COUNT(*) FILTER (WHERE NULLIF(TRIM(${users.phone}), '') IS NOT NULL OR NULLIF(TRIM(${users.email}), '') IS NOT NULL)::int`,
    }).from(users).where(eq(users.role, "organizer")),
  ])

  const totalPages = Math.max(1, Math.ceil((countRow?.count ?? 0) / LIMIT))
  const statCards = [
    { label: "All organizers", value: stats?.total ?? 0, icon: UsersRound, tone: "text-sky-700", bg: "bg-sky-50" },
    { label: `New in ${NEW_DAYS} days`, value: stats?.newCount ?? 0, icon: Clock3, tone: "text-violet-700", bg: "bg-violet-50" },
    { label: "Pending approval", value: stats?.pending ?? 0, icon: BadgeX, tone: "text-amber-700", bg: "bg-amber-50" },
    { label: "Contactable", value: stats?.contactable ?? 0, icon: Phone, tone: "text-emerald-700", bg: "bg-emerald-50" },
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
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
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
                {item === "new" ? `New ${NEW_DAYS}d` : item}
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
                          <p className="text-[11px] text-ink-3 mt-1">{organizer.emailVerified ? "Email verified" : "Email unverified"}</p>
                        </td>
                        <td className="px-3 py-4">
                          {organizer.approvedAt ? (
                            <span className="inline-flex items-center gap-1 text-[12px] font-medium text-emerald-700"><BadgeCheck size={13} /> Approved</span>
                          ) : (
                            <form action={approveOrganizerAction.bind(null, organizer.id)}>
                              <button type="submit" className="inline-flex items-center gap-1 text-[12px] font-medium text-amber-700 hover:underline"><BadgeX size={13} /> Pending — approve</button>
                            </form>
                          )}
                        </td>
                        <td className="px-3 py-4 text-[12px] text-ink-2">
                          <span className="inline-flex items-center gap-1"><CalendarDays size={12} /> {organizer.eventCount} event{organizer.eventCount === 1 ? "" : "s"}</span>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center justify-end gap-1.5">
                            {organizer.email && <a href={`mailto:${organizer.email}`} title={`Email ${organizer.email}`} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-sky-50 text-[12px] font-medium text-sky-700 hover:bg-sky-100"><Mail size={12} /> Email</a>}
                            {organizer.phone && <a href={phoneHref(organizer.phone)} title={`Call ${organizer.phone}`} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-50 text-[12px] font-medium text-emerald-700 hover:bg-emerald-100"><Phone size={12} /> Call</a>}
                            {organizer.organizerSlug && <Link href={`/o/${organizer.organizerSlug}`} className="inline-flex w-8 h-8 items-center justify-center rounded-lg bg-paper-2 text-ink-2 hover:text-navy" title="View public organizer page"><ArrowUpRight size={13} /></Link>}
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
                    <span>·</span><span>{organizer.eventCount} events</span>
                    <span>·</span><span>{organizer.approvedAt ? "Approved" : "Pending approval"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {organizer.email && <a href={`mailto:${organizer.email}`} className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-sky-50 text-[12px] font-medium text-sky-700"><Mail size={12} /> Email</a>}
                    {organizer.phone && <a href={phoneHref(organizer.phone)} className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-emerald-50 text-[12px] font-medium text-emerald-700"><Phone size={12} /> Call</a>}
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
