import { auth } from "@/auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import {
  Calendar, MapPin, Ticket, ArrowUpRight, Download, Share2,
  Wallet, TrendingUp, ShoppingBag, Bus, Camera, RotateCcw,
  HelpCircle, ClipboardList, Music2, Footprints, CheckCircle2,
  Star,
} from "lucide-react"
import QrCode from "@/components/QrCode"
import { formatCurrency, formatDateShort } from "@/lib/utils"

const FEATURED_TICKET = {
  id: "TP-2026-NYUKI-A0427",
  event: "Nyuki Marathon 2026: One Bee, Million Futures",
  tier: "Early Bird — Half Marathon",
  venue: "National Sports Stadium, Harare",
  startsAt: new Date("2026-05-17T06:00:00"),
  gate: "Gate B",
  seat: "Open seating",
  qrValue: "TP|NYUKI2026|A0427|HRRE|EBHM",
  price: 12,
  currency: "USD",
} as const

const UPCOMING_TICKETS = [
  {
    id: "TP-2026-RUMBLE-B0198",
    event: "Rumble in SA, Pretoria",
    category: "Concert",
    emoji: "🎵",
    venue: "Propaganda, Pretoria",
    startsAt: new Date("2026-05-17T12:00:00"),
    href: "/tickets/TP-2026-RUMBLE-B0198",
  },
  {
    id: "TP-2026-WARMUP-C0044",
    event: "Nyuki Warm-up Run",
    category: "Walkathon",
    emoji: "🚶",
    venue: "Harare Gardens",
    startsAt: new Date("2026-04-12T07:00:00"),
    href: "/tickets/TP-2026-WARMUP-C0044",
  },
  {
    id: "TP-2026-NYUKI-A0427",
    event: "Nyuki Marathon 2026: One Bee, Million Futures",
    category: "Marathon",
    emoji: "🏃",
    venue: "National Sports Stadium, Harare",
    startsAt: new Date("2026-05-17T06:00:00"),
    href: "/tickets/TP-2026-NYUKI-A0427",
  },
] as const

const ACTIVITY = [
  {
    icon: Ticket,
    title: "Ticket purchased",
    sub: "Nyuki Marathon 2026 — Early Bird Half Marathon",
    ago: "2 days ago",
    color: "text-blue",
    bg: "bg-blue-soft",
  },
  {
    icon: ShoppingBag,
    title: "Merch ordered",
    sub: "Nyuki 2026 finisher tee (L) + cap",
    ago: "2 days ago",
    color: "text-emerald-600",
    bg: "bg-emerald-50",
  },
  {
    icon: Bus,
    title: "Shuttle booked",
    sub: "Kombi, Avondale to NSS — 05:00 pickup",
    ago: "1 day ago",
    color: "text-amber-600",
    bg: "bg-amber-50",
  },
  {
    icon: Camera,
    title: "Photo pack purchased",
    sub: "Race day digital photos — high resolution",
    ago: "1 day ago",
    color: "text-violet-600",
    bg: "bg-violet-50",
  },
  {
    icon: Ticket,
    title: "Ticket purchased",
    sub: "Rumble in SA, Pretoria — General Admission",
    ago: "5 days ago",
    color: "text-blue",
    bg: "bg-blue-soft",
  },
  {
    icon: RotateCcw,
    title: "Refund processed",
    sub: "Nyuki Warm-up Run — EcoCash refund $8.00",
    ago: "8 days ago",
    color: "text-rose-600",
    bg: "bg-rose-50",
  },
] as const

export default async function DashboardPage() {
  const session = await auth()
  if (!session) redirect("/auth/signin")
  if (session.user.role === "admin")     redirect("/admin")
  if (session.user.role === "organizer") redirect("/organizer")
  if (session.user.role === "vendor")    redirect("/vendors")

  const attendeeName = session.user.name ?? "Demo Attendee"

  return (
    <div>
      {/* Header */}
      <div className="border-b border-line bg-paper-2">
        <div className="max-w-6xl mx-auto px-5 md:px-8 py-10 md:py-14">
          <p className="text-[11px] font-semibold tracking-[0.18em] text-blue uppercase mb-2">Dashboard</p>
          <h1 className="text-[32px] md:text-[40px] font-bold tracking-tight leading-tight text-ink">
            Welcome back, {attendeeName.split(" ")[0]}
          </h1>
          <p className="mt-1.5 text-[14.5px] text-ink-2">{session.user.email}</p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-5 md:px-8 py-10 md:py-12 space-y-8">

        {/* Stats strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          {[
            { l: "Upcoming events", v: "3",     i: Calendar,  trend: "Next: 17 May" },
            { l: "Total tickets",   v: "5",     i: Ticket,    trend: "All time" },
            { l: "Past events",     v: "12",    i: CheckCircle2, trend: "Completed" },
            { l: "Loyalty points",  v: "1,240", i: Star,      trend: "+50 this week" },
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

        {/* Featured ticket + upcoming list */}
        <div className="grid grid-cols-12 gap-4 md:gap-6">

          {/* Featured ticket card */}
          <div className="col-span-12 md:col-span-7 rounded-2xl border border-line bg-paper shadow-sm overflow-hidden">
            {/* Card top bar */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-line">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold tracking-wide uppercase px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700">
                <CheckCircle2 size={10} /> Confirmed
              </span>
              <div className="flex items-center gap-1">
                <button className="inline-flex items-center gap-1.5 text-[12px] font-medium text-ink-2 hover:text-ink px-2.5 py-1.5 rounded-lg hover:bg-paper-2 transition-colors">
                  <Download size={13} /> Download
                </button>
                <button className="inline-flex items-center gap-1.5 text-[12px] font-medium text-ink-2 hover:text-ink px-2.5 py-1.5 rounded-lg hover:bg-paper-2 transition-colors">
                  <Share2 size={13} /> Share
                </button>
              </div>
            </div>

            {/* Card body */}
            <div className="relative flex flex-col md:flex-row">
              {/* Left: event details */}
              <div className="flex-1 p-5 md:p-6 min-w-0">
                <p className="text-[11px] font-semibold tracking-[0.16em] text-ink-3 uppercase mb-2">Your ticket</p>
                <h2 className="text-[17px] font-bold tracking-tight text-ink leading-snug mb-2">
                  {FEATURED_TICKET.event}
                </h2>
                <span className="inline-block text-[11px] font-semibold tracking-wide px-2.5 py-1 rounded-full bg-blue-soft text-blue mb-4">
                  {FEATURED_TICKET.tier}
                </span>

                <div className="space-y-2.5">
                  <div className="flex items-start gap-2.5 text-[13px] text-ink-2">
                    <Calendar size={14} className="text-ink-3 mt-0.5 shrink-0" />
                    <div>
                      <span className="font-semibold text-ink">{formatDateShort(FEATURED_TICKET.startsAt)}</span>
                      <span className="text-ink-3"> &middot; 06:00 AM</span>
                    </div>
                  </div>
                  <div className="flex items-start gap-2.5 text-[13px] text-ink-2">
                    <MapPin size={14} className="text-ink-3 mt-0.5 shrink-0" />
                    <span>{FEATURED_TICKET.venue}</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-[13px] text-ink-2">
                    <span className="text-ink-3 text-[11px] font-semibold tracking-wide uppercase w-14 shrink-0">Gate</span>
                    <span className="font-semibold text-ink">{FEATURED_TICKET.gate}</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-[13px] text-ink-2">
                    <span className="text-ink-3 text-[11px] font-semibold tracking-wide uppercase w-14 shrink-0">Seat</span>
                    <span>{FEATURED_TICKET.seat}</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-[13px] text-ink-2">
                    <span className="text-ink-3 text-[11px] font-semibold tracking-wide uppercase w-14 shrink-0">Name</span>
                    <span className="font-semibold text-ink">{attendeeName}</span>
                  </div>
                </div>

                <p className="mt-4 font-mono text-[11px] text-ink-3 tracking-widest select-all">
                  {FEATURED_TICKET.id}
                </p>
                <p className="mt-1 text-[12px] text-ink-2">
                  {formatCurrency(FEATURED_TICKET.price, FEATURED_TICKET.currency)}
                </p>
              </div>

              {/* Perforated divider */}
              <div className="hidden md:flex absolute top-0 bottom-0 left-[52%] flex-col items-center justify-between pointer-events-none">
                <span className="w-4 h-4 rounded-full bg-paper-2 border border-line -mt-2 shrink-0" />
                <div className="flex-1 border-l-2 border-dashed border-line my-1" />
                <span className="w-4 h-4 rounded-full bg-paper-2 border border-line -mb-2 shrink-0" />
              </div>

              {/* Right: QR panel */}
              <div className="md:w-[44%] flex flex-col items-center justify-center p-5 md:p-6 bg-paper-2 md:border-l border-t md:border-t-0 border-dashed border-line">
                <div className="rounded-xl overflow-hidden p-2 bg-white shadow-sm mb-3">
                  <QrCode value={FEATURED_TICKET.qrValue} size={180} />
                </div>
                <p className="text-[12px] text-ink-3 text-center mb-4">Show this at the gate</p>
                <button className="inline-flex items-center gap-2 text-[12px] font-semibold text-ink-2 hover:text-ink px-3 py-2 rounded-lg border border-line hover:border-line-2 bg-paper hover:bg-paper-2 transition-colors">
                  <Wallet size={13} /> Add to Apple Wallet
                </button>
              </div>
            </div>
          </div>

          {/* Upcoming tickets list */}
          <div className="col-span-12 md:col-span-5 rounded-2xl border border-line bg-paper overflow-hidden">
            <div className="px-5 md:px-6 py-4 border-b border-line">
              <h2 className="text-[16px] font-semibold tracking-tight text-ink">Upcoming tickets</h2>
            </div>
            <div className="divide-y divide-line">
              {UPCOMING_TICKETS.map((t) => (
                <Link
                  key={t.id}
                  href={t.href}
                  className="flex items-center gap-3 p-4 md:p-5 hover:bg-paper-2 transition-colors group"
                >
                  <div className="w-9 h-9 rounded-full border border-line bg-paper-2 flex items-center justify-center text-[18px] shrink-0 select-none">
                    {t.emoji}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13.5px] font-semibold text-ink leading-snug line-clamp-1">{t.event}</p>
                    <p className="text-[11.5px] text-ink-3 mt-0.5">
                      {formatDateShort(t.startsAt)} &middot; {t.venue.split(",")[0]}
                    </p>
                  </div>
                  <ArrowUpRight size={14} className="text-ink-3 group-hover:text-ink transition-colors shrink-0" />
                </Link>
              ))}
            </div>
            <div className="px-5 md:px-6 py-3.5 border-t border-line">
              <Link
                href="/tickets"
                className="text-[12.5px] font-semibold text-navy hover:underline inline-flex items-center gap-1"
              >
                View all tickets <ArrowUpRight size={12} />
              </Link>
            </div>
          </div>
        </div>

        {/* Recent activity */}
        <div className="rounded-2xl border border-line bg-paper overflow-hidden">
          <div className="px-5 md:px-6 py-4 border-b border-line">
            <h2 className="text-[16px] font-semibold tracking-tight text-ink">Recent activity</h2>
          </div>
          <div className="divide-y divide-line">
            {ACTIVITY.map((item, i) => {
              const Icon = item.icon
              return (
                <div key={i} className="flex items-start gap-3.5 px-5 md:px-6 py-4">
                  <div className={`mt-0.5 w-8 h-8 rounded-full ${item.bg} flex items-center justify-center shrink-0`}>
                    <Icon size={14} className={item.color} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13.5px] font-semibold text-ink">{item.title}</p>
                    <p className="text-[12px] text-ink-3 mt-0.5 line-clamp-1">{item.sub}</p>
                  </div>
                  <span className="text-[11.5px] text-ink-3 whitespace-nowrap mt-0.5">{item.ago}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            {
              title: "Browse events",
              body: "Find marathons, concerts, and more across Zimbabwe.",
              href: "/events",
              icon: Calendar,
            },
            {
              title: "Order history",
              body: "View all past tickets, merch, shuttles, and photo packs.",
              href: "/orders",
              icon: ClipboardList,
            },
            {
              title: "Get help",
              body: "FAQs, refund policy, and live support via EcoCash chat.",
              href: "/help",
              icon: HelpCircle,
            },
          ].map(({ title, body, href, icon: Icon }) => (
            <Link key={title} href={href} className="rounded-2xl border border-line bg-paper p-5 hover:border-line-2 hover:shadow-sm transition-all group">
              <div className="w-8 h-8 rounded-lg bg-paper-2 border border-line flex items-center justify-center mb-3">
                <Icon size={15} className="text-ink-2" />
              </div>
              <p className="text-[14px] font-semibold tracking-tight text-ink">{title}</p>
              <p className="text-[12.5px] text-ink-2 mt-1">{body}</p>
              <p className="mt-3 inline-flex items-center gap-1 text-[12.5px] font-semibold text-navy group-hover:gap-1.5 transition-all">
                Open <ArrowUpRight size={12} />
              </p>
            </Link>
          ))}
        </div>

        {/* Loyalty / referral strip */}
        <div className="rounded-2xl bg-blue-soft border border-line px-5 md:px-8 py-5 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="w-9 h-9 rounded-full bg-white/70 border border-line flex items-center justify-center shrink-0">
              <Star size={15} className="text-blue" />
            </div>
            <div>
              <p className="text-[14px] font-semibold text-ink">You have 1,240 loyalty points</p>
              <p className="text-[12.5px] text-ink-2 mt-0.5">
                Earn 50 points for every friend you refer. Redeem for ticket discounts.
              </p>
            </div>
          </div>
          <Link
            href="/referral"
            className="shrink-0 inline-flex items-center gap-2 rounded-xl bg-navy px-4 py-2.5 text-[13px] font-semibold text-white shadow-sm shadow-navy/20 hover:bg-navy-700 active:scale-[0.99] transition whitespace-nowrap"
          >
            Refer a friend <ArrowUpRight size={13} />
          </Link>
        </div>

      </div>
    </div>
  )
}
