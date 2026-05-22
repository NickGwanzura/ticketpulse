import { auth } from "@/auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import {
  Calendar, Ticket, ArrowUpRight,
  CheckCircle2, ClipboardList,
  HelpCircle, Star, Activity,
} from "lucide-react"
import PageHeader from "@/components/dashboard/PageHeader"
import EmptyState from "@/components/dashboard/EmptyState"

export default async function DashboardPage() {
  const session = await auth()
  if (!session) redirect("/auth/signin")
  if (session.user.role === "admin")     redirect("/admin")
  if (session.user.role === "organizer") redirect("/organizer")
  if (session.user.role === "vendor")    redirect("/vendors")

  const attendeeName = session.user.name ?? "Demo Attendee"

  return (
    <div className="tp-fade-up">
      <PageHeader
        eyebrow="Dashboard"
        title={`Welcome back, ${attendeeName.split(" ")[0]}`}
        subtitle={session.user.email ?? undefined}
        width="xl"
      />

      <div className="max-w-7xl mx-auto px-5 md:px-8 py-10 md:py-12 space-y-8">

        {/* Stats strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 tp-fade-up-1">
          {[
            { l: "Upcoming events", v: "0",  i: Calendar,    trend: "" },
            { l: "Total tickets",   v: "0",  i: Ticket,      trend: "All time" },
            { l: "Past events",     v: "0",  i: CheckCircle2, trend: "Completed" },
            { l: "Loyalty points",  v: "0",  i: Star,        trend: "" },
          ].map(({ l, v, i: Icon, trend }) => (
            <div key={l} className="rounded-2xl border border-line bg-paper p-5 tp-lift">
              <div className="flex items-center gap-2 mb-2.5">
                <Icon size={14} className="text-ink-3" />
                <span className="text-[11.5px] text-ink-3">{l}</span>
              </div>
              <p className="text-[26px] md:text-[28px] font-bold tracking-tight text-ink leading-none tabular-nums">{v}</p>
              <p className="text-[11.5px] text-ink-3 mt-2">{trend}</p>
            </div>
          ))}
        </div>

        {/* Featured ticket + upcoming list */}
        <div className="grid grid-cols-12 gap-4 md:gap-6 tp-fade-up-2">

          {/* Featured ticket card */}
          <div className="col-span-12 md:col-span-7 rounded-2xl border border-line bg-paper shadow-sm overflow-hidden">
            <EmptyState
              icon={Ticket}
              title="No featured ticket"
              body="Browse events and buy your first ticket. It will appear here."
              ctaLabel="Browse events"
              ctaHref="/events"
            />
          </div>

          {/* Upcoming tickets list */}
          <div className="col-span-12 md:col-span-5 rounded-2xl border border-line bg-paper overflow-hidden">
            <div className="px-5 md:px-6 py-4 border-b border-line">
              <h2 className="text-[16px] font-semibold tracking-tight text-ink">Upcoming tickets</h2>
            </div>
            <EmptyState
              icon={Ticket}
              title="No upcoming tickets"
              body="Tickets you buy will appear here."
              ctaLabel="Browse events"
              ctaHref="/events"
            />
          </div>
        </div>

        {/* Recent activity */}
        <div className="rounded-2xl border border-line bg-paper overflow-hidden tp-fade-up-3">
          <div className="px-5 md:px-6 py-4 border-b border-line">
            <h2 className="text-[16px] font-semibold tracking-tight text-ink">Recent activity</h2>
          </div>
          <EmptyState
            icon={Activity}
            title="No activity yet"
            body="Your ticket purchases, refunds, and orders will appear here."
          />
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
            <Link key={title} href={href} className="rounded-2xl border border-line bg-paper p-5 tp-lift group">
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
        <div className="rounded-2xl bg-green-50 border border-line px-5 md:px-8 py-5 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="w-9 h-9 rounded-full bg-white/70 border border-line flex items-center justify-center shrink-0">
              <Star size={15} className="text-green-600" />
            </div>
            <div>
              <p className="text-[14px] font-semibold text-ink">You have 0 loyalty points</p>
              <p className="text-[12.5px] text-ink-2 mt-0.5">
                Earn 50 points for every friend you refer. Redeem for ticket discounts.
              </p>
            </div>
          </div>
          <Link
            href="/referral"
            className="shrink-0 inline-flex items-center gap-2 rounded-xl bg-green-600 px-4 py-2.5 text-[13px] font-semibold text-white shadow-sm shadow-green-600/20 hover:bg-green-700 active:scale-[0.99] transition whitespace-nowrap"
          >
            Refer a friend <ArrowUpRight size={13} />
          </Link>
        </div>

      </div>
    </div>
  )
}
