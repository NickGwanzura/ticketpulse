import { auth } from "@/auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import {
  Plus, ArrowUpRight, Calendar, DollarSign, Users, Ticket, TrendingUp, MoreHorizontal,
} from "lucide-react"
import { formatCurrency, formatDateShort } from "@/lib/utils"

const MOCK_EVENTS = [
  { id: "1", slug: "nyuki-marathon-2026", title: "Nyuki Marathon 2026: One Bee, Million Futures", category: "Marathon", venue: "National Sports Stadium, Harare", startsAt: new Date("2026-05-17T06:00:00"), status: "published", sold: 1280, capacity: 2000, revenue: 9430, currency: "USD" },
  { id: "2", slug: "rumble-in-sa-pretoria-2026", title: "Rumble in SA — Pretoria", category: "Concert", venue: "Propaganda, Pretoria", startsAt: new Date("2026-05-17T12:00:00"), status: "published", sold: 420, capacity: 800, revenue: 147000, currency: "ZAR" },
  { id: "3", slug: "nyuki-warmup-run", title: "Nyuki Warm-up Run", category: "Walkathon", venue: "Harare Gardens", startsAt: new Date("2026-04-12T07:00:00"), status: "draft", sold: 0, capacity: 300, revenue: 0, currency: "USD" },
] as const

const STATUS_STYLE: Record<string, string> = {
  published: "bg-emerald-50 text-emerald-700",
  draft:     "bg-paper-2 text-ink-2 ring-1 ring-line",
  sold_out:  "bg-rose-50 text-rose-700",
  cancelled: "bg-rose-50 text-rose-700",
}

export default async function OrganizerPage() {
  const session = await auth()
  if (!session) redirect("/auth/signin?callbackUrl=/organizer")

  const totalRevenue = MOCK_EVENTS.reduce((s, e) => s + (e.currency === "USD" ? e.revenue : 0), 0)
  const totalSold = MOCK_EVENTS.reduce((s, e) => s + e.sold, 0)
  const liveEvents = MOCK_EVENTS.filter((e) => e.status === "published").length

  return (
    <div>
      <div className="border-b border-line bg-paper-2">
        <div className="max-w-7xl mx-auto px-5 md:px-8 py-10 md:py-14 flex flex-col md:flex-row md:items-end md:justify-between gap-5">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.18em] text-blue uppercase mb-2">Organizer</p>
            <h1 className="text-[32px] md:text-[40px] font-bold tracking-tight leading-tight text-ink">
              Your events
            </h1>
            <p className="mt-1.5 text-[14.5px] text-ink-2">
              Welcome back, {session.user.name?.split(" ")[0] ?? "organizer"}.
            </p>
          </div>
          <Link
            href="/organizer/new"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-navy px-5 py-3 text-sm font-semibold text-white shadow-sm shadow-navy/20 hover:bg-navy-700 active:scale-[0.99] transition"
          >
            <Plus size={15} /> Create event
          </Link>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-5 md:px-8 py-10">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-10">
          {[
            { l: "Live events",  v: liveEvents.toString(),                                      i: Calendar,  trend: "+1 this week" },
            { l: "Tickets sold", v: totalSold.toLocaleString(),                                 i: Ticket,    trend: "+248 this week" },
            { l: "Revenue (USD)",v: formatCurrency(totalRevenue, "USD"),                        i: DollarSign,trend: "+12.4% MoM" },
            { l: "Followers",    v: "5,840",                                                    i: Users,     trend: "+184 this week" },
          ].map(({ l, v, i: Icon, trend }) => (
            <div key={l} className="rounded-2xl border border-line bg-paper p-5">
              <div className="flex items-center gap-2 mb-2.5">
                <Icon size={14} className="text-ink-3" />
                <span className="text-[11.5px] text-ink-3">{l}</span>
              </div>
              <p className="text-[26px] md:text-[28px] font-bold tracking-tight text-ink leading-none">{v}</p>
              <p className="text-[11.5px] text-emerald-700 mt-2 inline-flex items-center gap-1">
                <TrendingUp size={11} /> {trend}
              </p>
            </div>
          ))}
        </div>

        {/* Events table */}
        <div className="rounded-2xl border border-line bg-paper overflow-hidden">
          <div className="flex items-center justify-between px-5 md:px-6 py-4 border-b border-line">
            <h2 className="text-[16px] font-semibold tracking-tight text-ink">All events</h2>
            <div className="flex items-center gap-1.5">
              <button className="text-[12.5px] font-medium text-ink-2 hover:text-ink px-3 py-1.5 rounded-md hover:bg-paper-2">All</button>
              <button className="text-[12.5px] font-medium text-ink-2 hover:text-ink px-3 py-1.5 rounded-md hover:bg-paper-2">Live</button>
              <button className="text-[12.5px] font-medium text-ink-2 hover:text-ink px-3 py-1.5 rounded-md hover:bg-paper-2">Drafts</button>
            </div>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden divide-y divide-line">
            {MOCK_EVENTS.map((e) => (
              <Link key={e.id} href={`/events/${e.slug}`} className="block p-5 hover:bg-paper-2 transition-colors">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <span className={`text-[10px] font-semibold tracking-wide uppercase px-2 py-0.5 rounded-full ${STATUS_STYLE[e.status]}`}>
                    {e.status}
                  </span>
                  <ArrowUpRight size={14} className="text-ink-3" />
                </div>
                <p className="text-[14.5px] font-semibold tracking-tight text-ink line-clamp-1">{e.title}</p>
                <p className="text-[12.5px] text-ink-2 mt-0.5">{e.venue}</p>
                <div className="mt-3 flex items-center gap-x-4 gap-y-1 flex-wrap text-[12px]">
                  <span className="text-ink-3">{formatDateShort(e.startsAt)}</span>
                  <span className="text-ink-2"><span className="font-semibold text-ink">{e.sold}</span>/{e.capacity}</span>
                  <span className="text-ink font-semibold">{formatCurrency(e.revenue, e.currency)}</span>
                </div>
              </Link>
            ))}
          </div>

          {/* Desktop table */}
          <table className="hidden md:table w-full">
            <thead>
              <tr className="border-b border-line text-[11px] font-semibold tracking-widest text-ink-3 uppercase">
                <th className="text-left px-6 py-3 font-semibold">Event</th>
                <th className="text-left px-3 py-3 font-semibold">Date</th>
                <th className="text-left px-3 py-3 font-semibold">Status</th>
                <th className="text-right px-3 py-3 font-semibold">Sold</th>
                <th className="text-right px-3 py-3 font-semibold">Revenue</th>
                <th className="px-3 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {MOCK_EVENTS.map((e) => {
                const pct = Math.round((e.sold / e.capacity) * 100)
                return (
                  <tr key={e.id} className="hover:bg-paper-2 transition-colors">
                    <td className="px-6 py-4 max-w-xs">
                      <p className="text-[14px] font-semibold tracking-tight text-ink line-clamp-1">{e.title}</p>
                      <p className="text-[12px] text-ink-3 mt-0.5">{e.venue}</p>
                    </td>
                    <td className="px-3 py-4 text-[13px] text-ink-2 whitespace-nowrap">{formatDateShort(e.startsAt)}</td>
                    <td className="px-3 py-4">
                      <span className={`text-[10.5px] font-semibold tracking-wide uppercase px-2 py-1 rounded-full ${STATUS_STYLE[e.status]}`}>
                        {e.status}
                      </span>
                    </td>
                    <td className="px-3 py-4 text-right whitespace-nowrap">
                      <p className="text-[13px] font-semibold text-ink">{e.sold.toLocaleString()} <span className="text-ink-3 font-normal">/ {e.capacity.toLocaleString()}</span></p>
                      <div className="w-24 h-1 bg-paper-2 rounded-full mt-1.5 ml-auto overflow-hidden">
                        <div className="h-full bg-navy" style={{ width: `${pct}%` }} />
                      </div>
                    </td>
                    <td className="px-3 py-4 text-right text-[14px] font-bold tracking-tight text-ink whitespace-nowrap">
                      {formatCurrency(e.revenue, e.currency)}
                    </td>
                    <td className="px-3 py-4 text-right">
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

        {/* Quick links */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { title: "Set up payouts",  body: "Add EcoCash or bank to receive payouts.", href: "/payouts" },
            { title: "Browse vendors",  body: "Find catering, sound, security and more.", href: "/vendors" },
            { title: "Read the guide",  body: "Selling tips for first-time organizers.", href: "/help" },
          ].map(({ title, body, href }) => (
            <Link key={title} href={href} className="rounded-2xl border border-line bg-paper p-5 hover:border-line-2 hover:shadow-sm transition-all">
              <p className="text-[14px] font-semibold tracking-tight text-ink">{title}</p>
              <p className="text-[12.5px] text-ink-2 mt-1">{body}</p>
              <p className="mt-3 inline-flex items-center gap-1 text-[12.5px] font-semibold text-navy">
                Open <ArrowUpRight size={12} />
              </p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
