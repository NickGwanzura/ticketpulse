import { redirect } from "next/navigation"
import {
  Search, UserCheck, ShieldCheck, Store, User, ShieldAlert, Users,
  BadgeCheck, BadgeX, MailCheck, MailX, Percent,
} from "lucide-react"
import { desc, eq } from "drizzle-orm"

import { auth } from "@/auth"
import { db } from "@/db"
import { users, userRoleEnum } from "@/db/schema"
import PageHeader from "@/components/dashboard/PageHeader"
import EmptyState from "@/components/dashboard/EmptyState"
import InviteUserDialog from "./_components/InviteUserDialog"
import { verifyUserEmailAction, unverifyUserEmailAction, updateCommissionRateAction } from "@/app/admin/actions"
import CommissionRateInput from "./_components/CommissionRateInput"

type Role = "attendee" | "organizer" | "vendor" | "admin"

const ROLE_STYLE: Record<Role, string> = {
  attendee:  "bg-violet-50 text-violet-700",
  organizer: "bg-sky-50 text-sky-700",
  vendor:    "bg-green-50 text-green-700",
  admin:     "bg-amber-50 text-amber-700",
}

const AVATAR_COLORS = [
  "bg-rose-100 text-rose-700",
  "bg-sky-100 text-sky-700",
  "bg-violet-100 text-violet-700",
  "bg-green-100 text-green-700",
  "bg-amber-100 text-amber-700",
  "bg-cyan-100 text-cyan-700",
  "bg-pink-100 text-pink-700",
  "bg-indigo-100 text-indigo-700",
]

const FILTER_PILLS = ["All", "Attendees", "Organizers", "Vendors", "Admins"]

function colorFor(name: string | null | undefined): string {
  const s = name ?? "?"
  let hash = 0
  for (let i = 0; i < s.length; i++) hash = (hash * 31 + s.charCodeAt(i)) | 0
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

function initial(name: string | null, email: string | null): string {
  return (name ?? email ?? "?")[0].toUpperCase()
}

export default async function AdminUsersPage() {
  const session = await auth()
  if (!session?.user || session.user.role !== "admin") {
    redirect("/auth/signin?callbackUrl=/admin/users")
  }

  const allUsers = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      emailVerified: users.emailVerified,
      commissionRate: users.commissionRate,
      createdAt: users.createdAt,
    })
    .from(users)
    .orderBy(desc(users.createdAt))
    .limit(200)

  const stats = {
    total:     allUsers.length,
    attendee:  allUsers.filter((u) => u.role === "attendee").length,
    organizer: allUsers.filter((u) => u.role === "organizer").length,
    vendor:    allUsers.filter((u) => u.role === "vendor").length,
    admin:     allUsers.filter((u) => u.role === "admin").length,
  }

  const statCards = [
    { label: "Total users",  value: stats.total,     icon: User,        tone: "text-ink-2",      bg: "bg-paper-2" },
    { label: "Attendees",    value: stats.attendee,   icon: UserCheck,   tone: "text-violet-700", bg: "bg-violet-50" },
    { label: "Organizers",   value: stats.organizer,  icon: ShieldCheck, tone: "text-sky-700",    bg: "bg-sky-50" },
    { label: "Vendors",      value: stats.vendor,     icon: Store,       tone: "text-green-700",bg: "bg-green-50" },
    { label: "Admins",       value: stats.admin,      icon: ShieldAlert, tone: "text-amber-700",  bg: "bg-amber-50" },
  ]

  return (
    <div className="tp-fade-up">
      <PageHeader
        eyebrow="Users"
        title="People on TicketPulse"
        subtitle="Search, filter, and moderate accounts across roles."
        width="full"
        actions={<InviteUserDialog />}
      />

      <div className="px-5 md:px-8 py-8 md:py-10 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4 tp-fade-up-1">
          {statCards.map(({ label, value, icon: Icon, tone, bg }) => (
            <div key={label} className="rounded-2xl border border-line bg-paper p-5 tp-lift">
              <div className="flex items-center gap-2 mb-2.5">
                <span className={`inline-flex w-7 h-7 items-center justify-center rounded-lg ${bg}`}>
                  <Icon size={13} className={tone} />
                </span>
                <span className="text-[11.5px] text-ink-3">{label}</span>
              </div>
              <p className="text-[26px] md:text-[28px] font-bold tracking-tight text-ink leading-none tabular-nums">{value.toLocaleString()}</p>
            </div>
          ))}
        </div>

        {/* Search + filters */}
        <div className="flex flex-col md:flex-row md:items-center gap-3 tp-fade-up-2">
          <div className="relative flex-1 max-w-md">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3" />
            <input
              type="text"
              placeholder="Search by name or email"
              className="w-full rounded-xl border border-line bg-paper pl-9 pr-3 py-2.5 text-[13px] text-ink placeholder:text-ink-3 focus:outline-none focus:border-line-2 focus:ring-4 focus:ring-green-500/10"
            />
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {FILTER_PILLS.map((p, i) => (
              <button
                key={p}
                className={`rounded-lg px-3.5 py-1.5 text-[12.5px] whitespace-nowrap transition-colors ${
                  i === 0 ? "bg-paper-2 text-ink font-semibold ring-1 ring-line" : "text-ink-2 hover:text-ink hover:bg-paper-2 font-medium"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="rounded-2xl border border-line bg-paper overflow-hidden tp-fade-up-3">
          {allUsers.length > 0 ? (
            <>
              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full min-w-[900px]">
                  <thead>
                    <tr className="border-b border-line text-[11px] font-semibold tracking-widest text-ink-3 uppercase">
                      <th className="text-left px-5 py-3 font-semibold">User</th>
                      <th className="text-left px-3 py-3 font-semibold">Role</th>
                      <th className="text-left px-3 py-3 font-semibold">Email verified</th>
                      <th className="text-left px-3 py-3 font-semibold">Commission</th>
                      <th className="text-left px-3 py-3 font-semibold">Joined</th>
                      <th className="px-3 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {allUsers.map((u) => (
                      <tr key={u.id} className="hover:bg-paper-2 transition-colors">
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <span className={`inline-flex w-9 h-9 items-center justify-center rounded-full text-[12.5px] font-bold ${colorFor(u.name ?? u.email)}`}>
                              {initial(u.name, u.email)}
                            </span>
                            <div className="min-w-0">
                              <p className="text-[13.5px] font-semibold tracking-tight text-ink line-clamp-1">{u.name ?? "—"}</p>
                              <p className="text-[11.5px] text-ink-3 line-clamp-1">{u.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3.5">
                          <span className={`text-[10.5px] font-semibold tracking-wide uppercase px-2 py-1 rounded-full ${ROLE_STYLE[u.role as Role]}`}>
                            {u.role}
                          </span>
                        </td>
                        <td className="px-3 py-3.5">
                          {u.emailVerified ? (
                            <span className="inline-flex items-center gap-1 text-[11.5px] font-medium text-green-700">
                              <BadgeCheck size={13} /> Verified
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11.5px] font-medium text-ink-3">
                              <BadgeX size={13} /> Unverified
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-3.5">
                          {u.role === "organizer" ? (
                            <CommissionRateInput userId={u.id} rate={u.commissionRate} />
                          ) : (
                            <span className="text-[12px] text-ink-3">—</span>
                          )}
                        </td>
                        <td className="px-3 py-3.5 text-[12.5px] text-ink-2 whitespace-nowrap">
                          {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "—"}
                        </td>
                        <td className="px-3 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {u.emailVerified ? (
                              <form action={unverifyUserEmailAction.bind(null, u.id)}>
                                <button
                                  type="submit"
                                  title="Unverify email"
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-md text-ink-3 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                                >
                                  <MailX size={14} />
                                </button>
                              </form>
                            ) : (
                              <form action={verifyUserEmailAction.bind(null, u.id)}>
                                <button
                                  type="submit"
                                  title="Verify email"
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-md text-ink-3 hover:text-green-600 hover:bg-green-50 transition-colors"
                                >
                                  <MailCheck size={14} />
                                </button>
                              </form>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile list */}
              <ul className="md:hidden divide-y divide-line">
                {allUsers.map((u) => (
                  <li key={u.id} className="p-5">
                    <div className="flex items-center gap-3 mb-2">
                      <span className={`shrink-0 inline-flex w-10 h-10 items-center justify-center rounded-full text-[13px] font-bold ${colorFor(u.name ?? u.email)}`}>
                        {initial(u.name, u.email)}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13.5px] font-semibold tracking-tight text-ink line-clamp-1">{u.name ?? "—"}</p>
                        <p className="text-[11.5px] text-ink-3 line-clamp-1">{u.email}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 mb-3">
                      <span className={`text-[10px] font-semibold tracking-wide uppercase px-2 py-0.5 rounded-full ${ROLE_STYLE[u.role as Role]}`}>{u.role}</span>
                      {u.emailVerified ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-green-700 px-2 py-0.5 rounded-full bg-green-50">
                          <BadgeCheck size={10} /> Verified
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-ink-3 px-2 py-0.5 rounded-full bg-paper-2">
                          <BadgeX size={10} /> Unverified
                        </span>
                      )}
                    </div>
                    {u.role === "organizer" && (
                      <div className="mb-3">
                        <CommissionRateInput userId={u.id} rate={u.commissionRate} />
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      {u.emailVerified ? (
                        <form action={unverifyUserEmailAction.bind(null, u.id)}>
                          <button
                            type="submit"
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-amber-50 text-amber-700 hover:bg-amber-100 text-[12px] font-medium transition-colors"
                          >
                            <MailX size={12} /> Unverify
                          </button>
                        </form>
                      ) : (
                        <form action={verifyUserEmailAction.bind(null, u.id)}>
                          <button
                            type="submit"
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-green-50 text-green-700 hover:bg-green-100 text-[12px] font-medium transition-colors"
                          >
                            <MailCheck size={12} /> Verify email
                          </button>
                        </form>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <EmptyState
              icon={Users}
              title="No users yet"
              body="Registered attendees, organizers, and vendors will appear here."
              variant="inline"
            />
          )}
        </div>
      </div>
    </div>
  )
}
