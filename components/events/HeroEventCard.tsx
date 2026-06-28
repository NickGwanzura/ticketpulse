import Link from "next/link"
import { Calendar, MapPin, Flame } from "lucide-react"
import { formatCurrency, formatDateShort } from "@/lib/utils"
import SplitCTA from "@/components/ui/SplitCTA"

interface HeroEventProps {
  slug: string
  title: string
  category: string
  venue: string
  city: string
  startsAt: Date | string
  coverImage?: string | null
  lowestPrice?: number | null
  currency?: string
  soldQuantity?: number
  totalQuantity?: number
  sponsored?: boolean
  tags?: string[] | null
}

const CATEGORY_EMOJI: Record<string, string> = {
  concert: "🎵",
  marathon: "🏃",
  walkathon: "🚶",
  film: "🎬",
  exhibition: "🏢",
  expedition: "⛰️",
}

const CATEGORY_GRADIENT: Record<string, string> = {
  concert:    "from-violet-600 via-fuchsia-700 to-pink-800",
  marathon:   "from-sky-600 via-blue-700 to-cyan-800",
  walkathon:  "from-green-600 via-teal-700 to-cyan-800",
  film:       "from-amber-600 via-orange-700 to-rose-800",
  exhibition: "from-slate-600 via-blue-700 to-indigo-800",
  expedition: "from-lime-600 via-green-700 to-teal-800",
}

function timeUntil(date: Date): { label: string; kind: "soon" | "near" | "far" } | null {
  const now = new Date()
  const event = new Date(date)
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const eventDay = new Date(event.getFullYear(), event.getMonth(), event.getDate())
  const diffDays = Math.round((eventDay.getTime() - today.getTime()) / 86_400_000)
  if (diffDays < 0) return null
  if (diffDays === 0) return { label: "Today", kind: "soon" }
  if (diffDays === 1) return { label: "Tomorrow", kind: "soon" }
  if (diffDays <= 7)  return { label: `In ${diffDays} days`, kind: "soon" }
  if (diffDays <= 30) return { label: `In ${diffDays} days`, kind: "near" }
  if (diffDays <= 90) return { label: `In ${Math.round(diffDays / 7)} weeks`, kind: "far" }
  return { label: `In ${Math.round(diffDays / 30)} months`, kind: "far" }
}

export default function HeroEventCard({
  slug, title, category, venue, city, startsAt,
  coverImage, lowestPrice, currency = "USD",
  sponsored, tags,
}: HeroEventProps) {
  const date = startsAt instanceof Date ? startsAt : new Date(startsAt)
  const remaining = timeUntil(date)
  const emoji = CATEGORY_EMOJI[category.toLowerCase()] ?? "🎫"
  const gradient = CATEGORY_GRADIENT[category.toLowerCase()] ?? "from-navy via-blue-800 to-indigo-900"
  const sellingFast = tags?.includes("selling-fast") ?? title.trim().toLowerCase() === "shenergy"

  return (
    <section className="tp-premium-card relative overflow-hidden rounded-3xl border border-line bg-navy shadow-xl shadow-ink/10">
      {/* Background */}
      {coverImage ? (
        <>
          <img
            src={coverImage}
            alt={`${title} — ${venue}, ${city}`}
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/40 to-black/30" />
        </>
      ) : (
        <div className={`absolute inset-0 bg-gradient-to-br ${gradient}`} />
      )}

      {/* Decorative pattern overlay */}
      <div className="absolute inset-0 opacity-[0.04] pointer-events-none">
        <svg viewBox="0 0 400 200" className="w-full h-full">
          <pattern id="hero-grid" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
            <circle cx="20" cy="20" r="1.5" fill="white" />
          </pattern>
          <rect width="100%" height="100%" fill="url(#hero-grid)" />
        </svg>
      </div>

      {/* Soft accent glow */}
      <div className="absolute -top-32 -right-32 w-80 h-80 rounded-full bg-white/10 blur-[100px] pointer-events-none" />
      <div className="absolute -bottom-32 -left-32 w-80 h-80 rounded-full bg-white/5 blur-[100px] pointer-events-none" />

      {/* Content */}
      <div className="relative z-10 p-6 md:p-10 lg:p-14 flex flex-col md:flex-row md:items-end md:justify-between gap-6 min-h-[360px] md:min-h-[400px]">
        <div className="max-w-2xl">
          {/* Category badge + Sponsored badge */}
          <div className="flex items-center gap-2 mb-4">
            <div className="inline-flex items-center gap-1.5 backdrop-blur-sm bg-white/15 text-white text-[10px] font-semibold tracking-wide px-3 py-1.5 rounded-full ring-1 ring-white/20">
              <span>{emoji}</span>
              <span>{category}</span>
            </div>
            {sponsored && (
              <span className="inline-flex items-center gap-1.5 bg-gradient-to-r from-amber-500 to-yellow-400 text-white text-[10px] font-bold px-2.5 py-1.5 rounded-full ring-1 ring-white/20 shadow-sm">
                SPONSORED
              </span>
            )}
          </div>

          {/* Title */}
          <h2 className="text-[28px] md:text-[44px] lg:text-[52px] font-bold tracking-tight leading-tight text-white">
            {title}
          </h2>

          {/* Meta */}
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-[14px] text-white/80">
            <span className="flex items-center gap-2">
              <Calendar size={15} className="text-white/60" />
              {formatDateShort(date)}
            </span>
            <span className="flex items-center gap-2">
              <MapPin size={15} className="text-white/60" />
              {venue}, {city}
            </span>
          </div>

          {/* Countdown + CTA row */}
          <div className="mt-6 flex flex-wrap items-center gap-3">
            {sellingFast && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/22 px-3.5 py-2 text-[13px] font-bold text-rose-100 ring-1 ring-rose-300/45 backdrop-blur-sm">
                <Flame size={14} className="animate-pulse fill-rose-200/30 text-rose-200" />
                Tickets selling fast
              </span>
            )}
            {remaining && (
              <span className={`inline-flex items-center gap-1.5 backdrop-blur-sm text-[13px] font-semibold px-3.5 py-2 rounded-full ring-1 ${
                remaining.kind === "soon"
                  ? "bg-rose-500/20 text-rose-200 ring-rose-400/40"
                  : remaining.kind === "near"
                  ? "bg-amber-500/20 text-amber-200 ring-amber-400/40"
                  : "bg-white/10 text-white/70 ring-white/20"
              }`}>
                {remaining.kind === "soon" && <Flame size={13} className="text-rose-300" />}
                {remaining.label}
              </span>
            )}
            <SplitCTA
              href={`/events/${slug}`}
              label={lowestPrice != null ? `Get tickets from ${formatCurrency(lowestPrice, currency)}` : "Get tickets"}
              size="lg"
            />
          </div>
        </div>

      </div>
    </section>
  )
}
