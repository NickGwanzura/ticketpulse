import Link from "next/link"
import { CalendarCheck, FileText, Clock3, XCircle, MoreHorizontal, Star } from "lucide-react"
import { formatCurrency, formatDateShort } from "@/lib/utils"

type Status = "published" | "draft" | "review" | "cancelled"

const EVENTS = [
  { id: "e-01", title: "Rumble in SA, Pretoria",            organizer: "Tariro Events",      city: "Pretoria",       startsAt: new Date("2026-05-17"), status: "published" as Status, sold: 1620, capacity: 2000, revenue: 248000, currency: "ZAR", featured: true  },
  { id: "e-02", title: "Nyuki Marathon 2026",                organizer: "Kudzai Productions", city: "Harare",         startsAt: new Date("2026-05-17"), status: "published" as Status, sold: 1280, capacity: 2000, revenue: 9430,   currency: "USD", featured: true  },
  { id: "e-03", title: "Harare Jazz Night",                  organizer: "Chiedza Live",       city: "Harare",         startsAt: new Date("2026-06-04"), status: "published" as Status, sold: 642,  capacity: 800,  revenue: 5780,   currency: "USD", featured: false },
  { id: "e-04", title: "Vic Falls Eco Expedition",           organizer: "Tendai Outdoors",    city: "Victoria Falls", startsAt: new Date("2026-07-22"), status: "published" as Status, sold: 184,  capacity: 240,  revenue: 8420,   currency: "USD", featured: false },
  { id: "e-05", title: "Bulawayo Film Premiere: Mukoma",     organizer: "Farai Films",        city: "Bulawayo",       startsAt: new Date("2026-05-30"), status: "published" as Status, sold: 320,  capacity: 500,  revenue: 2240,   currency: "USD", featured: true  },
  { id: "e-06", title: "Mutare Country Fair",                organizer: "Anesu Events",       city: "Mutare",         startsAt: new Date("2026-08-10"), status: "review"    as Status, sold: 0,    capacity: 1500, revenue: 0,      currency: "USD", featured: false },
  { id: "e-07", title: "Sungura Sundowner Vol. 2",            organizer: "Tariro Events",      city: "Harare",         startsAt: new Date("2026-09-02"), status: "draft"     as Status, sold: 0,    capacity: 600,  revenue: 0,      currency: "USD", featured: false },
  { id: "e-08", title: "CBD 5K",                             organizer: "Rumbidzai Chari",    city: "Harare",         startsAt: new Date("2026-06-22"), status: "draft"     as Status, sold: 0,    capacity: 400,  revenue: 0,      currency: "USD", featured: false },
  { id: "e-09", title: "Avondale Open Mic",                  organizer: "Munyaradzi T.",      city: "Harare",         startsAt: new Date("2026-04-08"), status: "cancelled" as Status, sold: 42,   capacity: 200,  revenue: 380,    currency: "USD", featured: false },
  { id: "e-10", title: "Borrowdale Art Exhibition",          organizer: "Chiedza Live",       city: "Harare",         startsAt: new Date("2026-10-14"), status: "review"    as Status, sold: 0,    capacity: 350,  revenue: 0,      currency: "USD", featured: false },
] as const

const STATUS_STYLE: Record<Status, string> = {
  published: "bg-emerald-50 text-emerald-700",
  draft:     "bg-paper-2 text-ink-2 ring-1 ring-line",
  review:    "bg-amber-50 text-amber-700",
  cancelled: "bg-rose-50 text-rose-700",
}

const STATUS_LABEL: Record<Status, string> = {
  published: "Live",
  draft:     "Draft",
  review:    "Review",
  cancelled: "Cancelled",
}

const TABS = ["All", "Live", "Drafts", "Pending review", "Cancelled"]

export default function AdminEventsPage() {
  const stats = [
    { label: "Live",            value: EVENTS.filter((e) => e.status === "published").length, icon: CalendarCheck, tone: "text-emerald-700", bg: "bg-emerald-50" },
    { label: "Drafts",          value: EVENTS.filter((e) => e.status === "draft").length,     icon: FileText,      tone: "text-ink-2",       bg: "bg-paper-2" },
    { label: "Pending review",  value: EVENTS.filter((e) => e.status === "review").length,    icon: Clock3,        tone: "text-amber-700",   bg: "bg-amber-50" },
    { label: "Cancelled",       value: EVENTS.filter((e) => e.status === "cancelled").length, icon: XCircle,       tone: "text-rose-700",    bg: "bg-rose-50" },
  ]

  return (
    <div>
      <div className="border-b border-line bg-paper-2">
        <div className="px-5 md:px-8 py-9 md:py-12">
          <p className="text-[11px] font-semibold tracking-[0.18em] text-blue uppercase mb-2">Events</p>
          <h1 className="text-[28px] md:text-[34px] font-bold tracking-tight leading-tight text-ink">
            Event moderation
          </h1>
          <p className="mt-1.5 text-[14px] text-ink-2">
            Approve publish requests, feature picks, and pause cancellations.
          </p>
        </div>
      </div>

      <div className="px-5 md:px-8 py-8 md:py-10 space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          {stats.map(({ label, value, icon: Icon, tone, bg }) => (
            <div key={label} className="rounded-2xl border border-line bg-paper p-5 flex items-center gap-4">
              <span className={`inline-flex w-10 h-10 items-center justify-center rounded-xl ${bg}`}>
                <Icon size={16} className={tone} />
              </span>
              <div>
                <p className="text-[11.5px] text-ink-3 mb-0.5">{label}</p>
                <p className="text-[22px] font-bold tracking-tight text-ink leading-none">{value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
          {TABS.map((t, i) => (
            <button
              key={t}
              className={`rounded-lg px-3.5 py-2 text-[13px] whitespace-nowrap transition-colors ${
                i === 0 ? "bg-paper-2 text-ink font-semibold ring-1 ring-line" : "text-ink-2 hover:text-ink hover:bg-paper-2 font-medium"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="rounded-2xl border border-line bg-paper overflow-hidden">
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
                  <th className="px-3 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {EVENTS.map((e) => {
                  const pct = Math.round((e.sold / e.capacity) * 100)
                  return (
                    <tr key={e.id} className="hover:bg-paper-2 transition-colors">
                      <td className="px-5 py-3.5 max-w-xs">
                        <Link href={`/events/${e.id}`} className="block">
                          <p className="text-[13.5px] font-semibold tracking-tight text-ink line-clamp-1 hover:text-navy transition-colors">{e.title}</p>
                          <p className="text-[11.5px] text-ink-3 mt-0.5">{e.city}</p>
                        </Link>
                      </td>
                      <td className="px-3 py-3.5 text-[12.5px] text-ink-2">{e.organizer}</td>
                      <td className="px-3 py-3.5 text-[12.5px] text-ink-2 whitespace-nowrap">{formatDateShort(e.startsAt)}</td>
                      <td className="px-3 py-3.5">
                        <span className={`text-[10.5px] font-semibold tracking-wide uppercase px-2 py-1 rounded-full ${STATUS_STYLE[e.status]}`}>
                          {STATUS_LABEL[e.status]}
                        </span>
                      </td>
                      <td className="px-3 py-3.5">
                        <div className="flex items-center justify-center">
                          <button
                            type="button"
                            aria-label={e.featured ? "Unfeature" : "Feature"}
                            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${e.featured ? "bg-navy" : "bg-paper-2 ring-1 ring-line"}`}
                          >
                            <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform ${e.featured ? "translate-x-5" : "translate-x-1"}`} />
                          </button>
                        </div>
                      </td>
                      <td className="px-3 py-3.5 text-right whitespace-nowrap">
                        <p className="text-[12.5px] font-semibold text-ink">{e.sold.toLocaleString()} <span className="text-ink-3 font-normal">/ {e.capacity.toLocaleString()}</span></p>
                        <div className="w-20 h-1 bg-paper-2 rounded-full mt-1 ml-auto overflow-hidden">
                          <div className="h-full bg-navy" style={{ width: `${pct}%` }} />
                        </div>
                      </td>
                      <td className="px-3 py-3.5 text-right text-[13px] font-bold tracking-tight text-ink whitespace-nowrap">
                        {formatCurrency(e.revenue, e.currency)}
                      </td>
                      <td className="px-3 py-3.5 text-right">
                        <button className="text-ink-3 hover:text-ink p-1.5 rounded-md hover:bg-paper-2">
                          <MoreHorizontal size={15} />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <ul className="md:hidden divide-y divide-line">
            {EVENTS.map((e) => {
              const pct = Math.round((e.sold / e.capacity) * 100)
              return (
                <li key={e.id} className="p-5">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className={`text-[10px] font-semibold tracking-wide uppercase px-2 py-0.5 rounded-full ${STATUS_STYLE[e.status]}`}>{STATUS_LABEL[e.status]}</span>
                        {e.featured && <Star size={11} className="text-amber-500 fill-amber-400" />}
                      </div>
                      <p className="text-[13.5px] font-semibold tracking-tight text-ink line-clamp-1">{e.title}</p>
                      <p className="text-[11.5px] text-ink-3 mt-0.5">{e.organizer} · {e.city}</p>
                    </div>
                    <p className="text-[13px] font-bold tracking-tight text-ink whitespace-nowrap">
                      {formatCurrency(e.revenue, e.currency)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1 bg-paper-2 rounded-full overflow-hidden">
                      <div className="h-full bg-navy" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-[11px] text-ink-3 whitespace-nowrap">{e.sold}/{e.capacity}</span>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      </div>
    </div>
  )
}
