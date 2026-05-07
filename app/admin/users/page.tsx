import { Search, MoreHorizontal, UserCheck, ShieldCheck, Store, User, ShieldAlert } from "lucide-react"
import { formatDateShort } from "@/lib/utils"

type Role = "attendee" | "organizer" | "vendor" | "admin"
type Status = "active" | "suspended"

const USERS = [
  { id: "u-01", name: "Tinashe Moyo",         email: "tinashe.moyo@example.zw",     role: "attendee"  as Role, status: "active"    as Status, joined: new Date("2026-04-28"), color: "bg-violet-100 text-violet-700" },
  { id: "u-02", name: "Tariro Chiweshe",      email: "tariro@tarir-events.zw",      role: "organizer" as Role, status: "active"    as Status, joined: new Date("2026-03-12"), color: "bg-sky-100 text-sky-700" },
  { id: "u-03", name: "Kudzai Productions",   email: "hello@kudzai.zw",             role: "organizer" as Role, status: "active"    as Status, joined: new Date("2026-02-04"), color: "bg-sky-100 text-sky-700" },
  { id: "u-04", name: "Anesu Sound & AV",     email: "ops@anesu-sound.zw",          role: "vendor"    as Role, status: "active"    as Status, joined: new Date("2026-01-19"), color: "bg-emerald-100 text-emerald-700" },
  { id: "u-05", name: "Farai Films",          email: "team@faraifilms.zw",          role: "organizer" as Role, status: "active"    as Status, joined: new Date("2025-12-08"), color: "bg-sky-100 text-sky-700" },
  { id: "u-06", name: "Rumbidzai Chari",      email: "rumbi.chari@example.zw",      role: "attendee"  as Role, status: "active"    as Status, joined: new Date("2025-11-21"), color: "bg-violet-100 text-violet-700" },
  { id: "u-07", name: "Munyaradzi Tafadzwa",  email: "muny.t@example.zw",           role: "attendee"  as Role, status: "suspended" as Status, joined: new Date("2025-10-04"), color: "bg-rose-100 text-rose-700" },
  { id: "u-08", name: "Chiedza Live",         email: "events@chiedza.zw",           role: "organizer" as Role, status: "active"    as Status, joined: new Date("2025-09-14"), color: "bg-sky-100 text-sky-700" },
  { id: "u-09", name: "Tendai Outdoors",      email: "info@tendai-outdoors.zw",     role: "vendor"    as Role, status: "active"    as Status, joined: new Date("2025-08-02"), color: "bg-emerald-100 text-emerald-700" },
  { id: "u-10", name: "Demo Admin",           email: "admin@ticketpulse.zw",        role: "admin"     as Role, status: "active"    as Status, joined: new Date("2025-06-01"), color: "bg-amber-100 text-amber-700" },
  { id: "u-11", name: "Anesu Mhondoro",       email: "anesu.m@example.zw",          role: "attendee"  as Role, status: "active"    as Status, joined: new Date("2026-04-12"), color: "bg-violet-100 text-violet-700" },
  { id: "u-12", name: "Tafadzwa Catering",    email: "book@tafa-cater.zw",          role: "vendor"    as Role, status: "active"    as Status, joined: new Date("2026-03-30"), color: "bg-emerald-100 text-emerald-700" },
] as const

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
    { label: "Total users",  value: USERS.length,                                          icon: User,        tone: "text-ink-2",      bg: "bg-paper-2" },
    { label: "Attendees",    value: USERS.filter((u) => u.role === "attendee").length,    icon: UserCheck,   tone: "text-violet-700", bg: "bg-violet-50" },
    { label: "Organizers",   value: USERS.filter((u) => u.role === "organizer").length,   icon: ShieldCheck, tone: "text-sky-700",    bg: "bg-sky-50" },
    { label: "Vendors",      value: USERS.filter((u) => u.role === "vendor").length,      icon: Store,       tone: "text-emerald-700",bg: "bg-emerald-50" },
    { label: "Admins",       value: USERS.filter((u) => u.role === "admin").length,       icon: ShieldAlert, tone: "text-amber-700",  bg: "bg-amber-50" },
  ]

  return (
    <div>
      <div className="border-b border-line bg-paper-2">
        <div className="px-5 md:px-8 py-9 md:py-12">
          <p className="text-[11px] font-semibold tracking-[0.18em] text-blue uppercase mb-2">Users</p>
          <h1 className="text-[28px] md:text-[34px] font-bold tracking-tight leading-tight text-ink">
            People on TicketPulse
          </h1>
          <p className="mt-1.5 text-[14px] text-ink-2">
            Search, filter, and moderate accounts across roles.
          </p>
        </div>
      </div>

      <div className="px-5 md:px-8 py-8 md:py-10 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4">
          {stats.map(({ label, value, icon: Icon, tone, bg }) => (
            <div key={label} className="rounded-2xl border border-line bg-paper p-5">
              <div className="flex items-center gap-2 mb-2.5">
                <span className={`inline-flex w-7 h-7 items-center justify-center rounded-lg ${bg}`}>
                  <Icon size={13} className={tone} />
                </span>
                <span className="text-[11.5px] text-ink-3">{label}</span>
              </div>
              <p className="text-[24px] font-bold tracking-tight text-ink leading-none">{value.toLocaleString()}</p>
            </div>
          ))}
        </div>

        {/* Search + filters */}
        <div className="flex flex-col md:flex-row md:items-center gap-3">
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
        <div className="rounded-2xl border border-line bg-paper overflow-hidden">
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
                    <td className="px-3 py-3.5 text-[12.5px] text-ink-2 whitespace-nowrap">{formatDateShort(u.joined)}</td>
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
        </div>
      </div>
    </div>
  )
}
