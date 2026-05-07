import { Search, MoreHorizontal, UserCheck, ShieldCheck, Store, User, ShieldAlert, Users } from "lucide-react"
import PageHeader from "@/components/dashboard/PageHeader"
import EmptyState from "@/components/dashboard/EmptyState"

type Role = "attendee" | "organizer" | "vendor" | "admin"
type Status = "active" | "suspended"

type UserRow = {
  id: string
  name: string
  email: string
  role: Role
  status: Status
  joined: Date
  color: string
}

const USERS: UserRow[] = []

const ROLE_STYLE: Record<Role, string> = {
  attendee:  "bg-violet-50 text-violet-700",
  organizer: "bg-sky-50 text-sky-700",
  vendor:    "bg-emerald-50 text-emerald-700",
  admin:     "bg-amber-50 text-amber-700",
}

const STATUS_STYLE: Record<Status, string> = {
  active:    "bg-emerald-50 text-emerald-700",
  suspended: "bg-rose-50 text-rose-700",
}

const FILTER_PILLS = ["All", "Attendees", "Organizers", "Vendors", "Suspended"]

export default function AdminUsersPage() {
  const stats = [
    { label: "Total users",  value: 0, icon: User,        tone: "text-ink-2",      bg: "bg-paper-2" },
    { label: "Attendees",    value: 0, icon: UserCheck,   tone: "text-violet-700", bg: "bg-violet-50" },
    { label: "Organizers",   value: 0, icon: ShieldCheck, tone: "text-sky-700",    bg: "bg-sky-50" },
    { label: "Vendors",      value: 0, icon: Store,       tone: "text-emerald-700",bg: "bg-emerald-50" },
    { label: "Admins",       value: 0, icon: ShieldAlert, tone: "text-amber-700",  bg: "bg-amber-50" },
  ]

  return (
    <div className="tp-fade-up">
      <PageHeader
        eyebrow="Users"
        title="People on TicketPulse"
        subtitle="Search, filter, and moderate accounts across roles."
        width="full"
      />

      <div className="px-5 md:px-8 py-8 md:py-10 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4 tp-fade-up-1">
          {stats.map(({ label, value, icon: Icon, tone, bg }) => (
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
              className="w-full rounded-xl border border-line bg-paper pl-9 pr-3 py-2.5 text-[13px] text-ink placeholder:text-ink-3 focus:outline-none focus:border-line-2 focus:ring-4 focus:ring-blue/10"
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
          {USERS.length > 0 ? (
            <>
              <div className="hidden md:block">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-line text-[11px] font-semibold tracking-widest text-ink-3 uppercase">
                      <th className="text-left px-5 py-3 font-semibold">User</th>
                      <th className="text-left px-3 py-3 font-semibold">Role</th>
                      <th className="text-left px-3 py-3 font-semibold">Joined</th>
                      <th className="text-left px-3 py-3 font-semibold">Status</th>
                      <th className="px-3 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {USERS.map((u) => (
                      <tr key={u.id} className="hover:bg-paper-2 transition-colors">
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <span className={`inline-flex w-9 h-9 items-center justify-center rounded-full text-[12.5px] font-bold ${u.color}`}>
                              {u.name[0]}
                            </span>
                            <div className="min-w-0">
                              <p className="text-[13.5px] font-semibold tracking-tight text-ink line-clamp-1">{u.name}</p>
                              <p className="text-[11.5px] text-ink-3 line-clamp-1">{u.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3.5">
                          <span className={`text-[10.5px] font-semibold tracking-wide uppercase px-2 py-1 rounded-full ${ROLE_STYLE[u.role]}`}>
                            {u.role}
                          </span>
                        </td>
                        <td className="px-3 py-3.5 text-[12.5px] text-ink-2 whitespace-nowrap">{u.joined.toLocaleDateString()}</td>
                        <td className="px-3 py-3.5">
                          <span className={`text-[10.5px] font-semibold tracking-wide uppercase px-2 py-1 rounded-full ${STATUS_STYLE[u.status]}`}>
                            {u.status}
                          </span>
                        </td>
                        <td className="px-3 py-3.5 text-right">
                          <button className="text-ink-3 hover:text-ink p-1.5 rounded-md hover:bg-paper-2">
                            <MoreHorizontal size={15} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <ul className="md:hidden divide-y divide-line">
                {USERS.map((u) => (
                  <li key={u.id} className="p-5 flex items-center gap-3">
                    <span className={`shrink-0 inline-flex w-10 h-10 items-center justify-center rounded-full text-[13px] font-bold ${u.color}`}>
                      {u.name[0]}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13.5px] font-semibold tracking-tight text-ink line-clamp-1">{u.name}</p>
                      <p className="text-[11.5px] text-ink-3 line-clamp-1">{u.email}</p>
                      <div className="mt-1.5 flex items-center gap-1.5">
                        <span className={`text-[10px] font-semibold tracking-wide uppercase px-2 py-0.5 rounded-full ${ROLE_STYLE[u.role]}`}>{u.role}</span>
                        <span className={`text-[10px] font-semibold tracking-wide uppercase px-2 py-0.5 rounded-full ${STATUS_STYLE[u.status]}`}>{u.status}</span>
                      </div>
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
