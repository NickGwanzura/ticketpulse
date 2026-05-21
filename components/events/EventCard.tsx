import Link from "next/link"
import { Calendar, MapPin, ArrowUpRight, Users, Flame } from "lucide-react"
import { formatCurrency, formatDateShort } from "@/lib/utils"

interface EventCardProps {
  id: string
  slug: string
  title: string
  category: string
  venue: string
  city: string
  startsAt: Date | string
  coverImage?: string | null
  featured?: boolean
  lowestPrice?: number | null
  currency?: string
  status?: string
  soldQuantity?: number
  totalQuantity?: number
}

interface CategoryVisual {
  gradient: string
  emoji: string
  tint: string
  ring: string
  pattern: React.ReactElement
}

const PATTERNS = {
  concert: (
    <svg viewBox="0 0 200 100" className="absolute inset-0 w-full h-full opacity-50" preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id="cwave" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#a78bfa" stopOpacity="0.3" />
          <stop offset="1" stopColor="#a78bfa" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d="M0 70 Q 25 50, 50 70 T 100 70 T 150 70 T 200 70 V100 H0 Z" fill="url(#cwave)" />
      <path d="M0 80 Q 25 65, 50 80 T 100 80 T 150 80 T 200 80" stroke="#8b5cf6" strokeWidth="0.8" fill="none" strokeOpacity="0.35" />
    </svg>
  ),
  marathon: (
    <svg viewBox="0 0 200 100" className="absolute inset-0 w-full h-full opacity-40" preserveAspectRatio="none" aria-hidden>
      {[20, 36, 52, 68].map((y) => (
        <line key={y} x1="0" x2="200" y1={y} y2={y} stroke="#0284c7" strokeWidth="0.6" strokeDasharray="3 4" strokeOpacity="0.4" />
      ))}
    </svg>
  ),
  walkathon: (
    <svg viewBox="0 0 200 100" className="absolute inset-0 w-full h-full opacity-50" preserveAspectRatio="none" aria-hidden>
      {Array.from({ length: 8 }).map((_, i) => (
        <ellipse key={i} cx={20 + i * 24} cy={i % 2 === 0 ? 75 : 65} rx="3" ry="5" fill="#059669" fillOpacity="0.35" transform={`rotate(${i % 2 === 0 ? -15 : 15} ${20 + i * 24} ${i % 2 === 0 ? 75 : 65})`} />
      ))}
    </svg>
  ),
  film: (
    <svg viewBox="0 0 200 100" className="absolute inset-0 w-full h-full opacity-30" preserveAspectRatio="none" aria-hidden>
      <rect x="0" y="0" width="200" height="14" fill="#92400e" fillOpacity="0.18" />
      <rect x="0" y="86" width="200" height="14" fill="#92400e" fillOpacity="0.18" />
      {Array.from({ length: 12 }).map((_, i) => (
        <rect key={i} x={6 + i * 17} y="3" width="8" height="8" fill="#fff" fillOpacity="0.5" />
      ))}
      {Array.from({ length: 12 }).map((_, i) => (
        <rect key={`b${i}`} x={6 + i * 17} y="89" width="8" height="8" fill="#fff" fillOpacity="0.5" />
      ))}
    </svg>
  ),
  exhibition: (
    <svg viewBox="0 0 200 100" className="absolute inset-0 w-full h-full opacity-40" preserveAspectRatio="none" aria-hidden>
      {[15, 60, 110, 155].map((x, i) => (
        <g key={x} fill="#475569" fillOpacity="0.18">
          <rect x={x} y={50 + (i % 2) * 6} width="30" height={50 - (i % 2) * 6} />
          <rect x={x + 4} y={56 + (i % 2) * 6} width="6" height="6" fill="#fff" fillOpacity="0.6" />
          <rect x={x + 14} y={56 + (i % 2) * 6} width="6" height="6" fill="#fff" fillOpacity="0.6" />
          <rect x={x + 4} y={68 + (i % 2) * 6} width="6" height="6" fill="#fff" fillOpacity="0.6" />
          <rect x={x + 14} y={68 + (i % 2) * 6} width="6" height="6" fill="#fff" fillOpacity="0.6" />
        </g>
      ))}
    </svg>
  ),
  expedition: (
    <svg viewBox="0 0 200 100" className="absolute inset-0 w-full h-full opacity-50" preserveAspectRatio="none" aria-hidden>
      <polygon points="0,100 40,40 70,70 110,20 150,55 200,30 200,100" fill="#65a30d" fillOpacity="0.22" />
      <polygon points="0,100 50,55 90,80 130,40 170,65 200,50 200,100" fill="#16a34a" fillOpacity="0.18" />
    </svg>
  ),
  default: (
    <svg viewBox="0 0 200 100" className="absolute inset-0 w-full h-full opacity-30" preserveAspectRatio="none" aria-hidden>
      <circle cx="40" cy="50" r="60" fill="#64748b" fillOpacity="0.1" />
      <circle cx="160" cy="40" r="40" fill="#64748b" fillOpacity="0.08" />
    </svg>
  ),
}

const CATEGORY_VISUAL: Record<string, CategoryVisual> = {
  concert:    { gradient: "from-violet-100 via-fuchsia-50 to-pink-50",  emoji: "🎵", tint: "text-violet-700",    ring: "ring-violet-200/60",   pattern: PATTERNS.concert },
  marathon:   { gradient: "from-sky-100 via-blue-50 to-cyan-50",        emoji: "🏃", tint: "text-sky-700",       ring: "ring-sky-200/60",      pattern: PATTERNS.marathon },
  walkathon:  { gradient: "from-emerald-100 via-teal-50 to-cyan-50",    emoji: "🚶", tint: "text-emerald-700",   ring: "ring-emerald-200/60",  pattern: PATTERNS.walkathon },
  film:       { gradient: "from-amber-100 via-orange-50 to-rose-50",    emoji: "🎬", tint: "text-amber-700",     ring: "ring-amber-200/60",    pattern: PATTERNS.film },
  exhibition: { gradient: "from-slate-100 via-blue-50 to-indigo-50",    emoji: "🏢", tint: "text-slate-700",     ring: "ring-slate-200/60",    pattern: PATTERNS.exhibition },
  expedition: { gradient: "from-lime-100 via-emerald-50 to-teal-50",    emoji: "⛰️", tint: "text-emerald-800",   ring: "ring-lime-200/60",     pattern: PATTERNS.expedition },
}

function timeUntil(date: Date): { label: string; kind: "soon" | "near" | "far" } | null {
  const now = new Date()
  const event = new Date(date)
  // Compare calendar days to avoid rounding errors
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

export default function EventCard({
  slug, title, category, venue, city, startsAt,
  coverImage, featured, lowestPrice, currency = "USD", status,
  soldQuantity, totalQuantity,
}: EventCardProps) {
  const visual = CATEGORY_VISUAL[category.toLowerCase()] ?? {
    gradient: "from-slate-100 to-slate-50",
    emoji: "🎫",
    tint: "text-slate-700",
    ring: "ring-slate-200/60",
    pattern: PATTERNS.default,
  }

  const date = startsAt instanceof Date ? startsAt : new Date(startsAt)
  const remaining = timeUntil(date)
  const going = soldQuantity ?? 0
  const capacity = totalQuantity ?? 0
  const pct = capacity > 0 ? Math.min(100, Math.round((going / capacity) * 100)) : 0
  const soldOut = status === "sold_out" || pct >= 100

  return (
    <Link
      href={`/events/${slug}`}
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-line bg-paper transition-all duration-300 hover:-translate-y-1 hover:border-line-2 hover:shadow-[0_24px_60px_-20px_rgba(10,37,64,0.22)]"
    >
      {/* Category header */}
      <div className={`relative h-44 overflow-hidden ${coverImage ? "bg-navy" : `bg-gradient-to-br ${visual.gradient}`}`}>
        {coverImage ? (
          <>
            {/* Cover image */}
            <img
              src={coverImage}
              alt=""
              className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
            {/* Dark overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-black/10" />
            {/* Hover shine */}
            <div className="absolute inset-0 bg-gradient-to-t from-paper/0 via-transparent to-paper/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
            {/* Category label */}
            <span className={`absolute bottom-3 left-3 inline-flex items-center gap-1.5 backdrop-blur-sm bg-white/15 text-white text-[9.5px] font-semibold tracking-wide px-2.5 py-1 rounded-full ring-1 ring-white/20`}>
              {visual.emoji} {category}
            </span>
          </>
        ) : (
          <>
            {/* Decorative pattern */}
            {visual.pattern}

            {/* Light wash */}
            <div className="absolute inset-0 [background:radial-gradient(800px_circle_at_30%_25%,rgba(255,255,255,0.7),transparent_60%)] pointer-events-none" />

            {/* Soft accent orb */}
            <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-white/40 blur-2xl pointer-events-none" />

            {/* Hover shine */}
            <div className="absolute inset-0 bg-gradient-to-t from-paper/0 via-transparent to-paper/30 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

            {/* Emoji */}
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-[60px] leading-none drop-shadow-sm transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-3">
                {visual.emoji}
              </span>
            </div>
          </>
        )}

        {/* Top-left: status */}
        {featured && !soldOut && (
          <span className="absolute top-3 left-3 inline-flex items-center gap-1.5 bg-navy text-white text-[10px] font-semibold tracking-wide px-2.5 py-1 rounded-full shadow-sm shadow-navy/20">
            <span className="w-1 h-1 rounded-full bg-white" /> FEATURED
          </span>
        )}
        {soldOut && (
          <span className="absolute top-3 left-3 bg-rose-600 text-white text-[10px] font-bold px-2.5 py-1 rounded-full shadow-sm">
            SOLD OUT
          </span>
        )}
        {!featured && !soldOut && status === "published" && (
          <span className="absolute top-3 left-3 bg-emerald-600 text-white text-[10px] font-semibold px-2.5 py-1 rounded-full shadow-sm">
            ON SALE
          </span>
        )}

        {/* Top-right: time-until or trending */}
        {remaining && (
          <span className={`absolute top-3 right-3 inline-flex items-center gap-1 backdrop-blur-md text-[10px] font-semibold px-2 py-1 rounded-full ring-1 ${
            remaining.kind === "soon"
              ? "bg-rose-50/90 text-rose-700 ring-rose-200/60"
              : remaining.kind === "near"
              ? "bg-amber-50/90 text-amber-800 ring-amber-200/60"
              : "bg-paper/85 text-ink-2 ring-line"
          }`}>
            {remaining.kind === "soon" && <Flame size={10} />}
            {remaining.label}
          </span>
        )}

        {/* Bottom strip, date band */}
        <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col p-5">
        <p className={`text-[10.5px] font-semibold tracking-[0.18em] uppercase mb-2 ${visual.tint}`}>{category}</p>

        <h3 className="text-[16px] font-semibold leading-snug tracking-tight text-ink mb-3 line-clamp-2 group-hover:text-navy-700 transition-colors">
          {title}
        </h3>

        <div className="space-y-1.5 mb-4">
          <div className="flex items-center gap-2 text-[13px] text-ink-2">
            <Calendar size={13} className="text-ink-3 shrink-0" />
            <span>{formatDateShort(date)}</span>
          </div>
          <div className="flex items-center gap-2 text-[13px] text-ink-2">
            <MapPin size={13} className="text-ink-3 shrink-0" />
            <span className="truncate">{venue}, {city}</span>
          </div>
        </div>

        {/* Capacity / going strip */}
        {!soldOut && status === "published" && capacity > 0 && (
          <div className="mb-4">
            <div className="flex items-center justify-between mb-1.5">
              <span className="inline-flex items-center gap-1.5 text-[11.5px] font-medium text-ink-2">
                <Users size={11} className="text-ink-3" />
                <span><span className="font-semibold text-ink">{going.toLocaleString()}</span> going</span>
              </span>
            </div>
            <div className="h-1 bg-paper-2 rounded-full overflow-hidden ring-1 ring-line">
              <div
                className={`h-full rounded-full transition-all duration-700 ${
                  pct >= 90 ? "bg-rose-500" : pct >= 70 ? "bg-amber-500" : "bg-emerald-500"
                }`}
                style={{ width: `${Math.max(8, pct)}%` }}
              />
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-auto flex items-center justify-between pt-4 border-t border-line">
          <div>
            {lowestPrice != null ? (
              <>
                <span className="text-[10.5px] text-ink-3">From</span>
                <span className="ml-1.5 text-[16px] font-bold tracking-tight text-ink">
                  {formatCurrency(lowestPrice, currency)}
                </span>
              </>
            ) : (
              <span className="text-[13px] font-semibold text-emerald-700">Free entry</span>
            )}
          </div>
          <span className="inline-flex items-center gap-1 rounded-lg bg-paper-2 ring-1 ring-line px-2.5 py-1.5 text-[12px] font-semibold text-navy group-hover:bg-navy group-hover:text-white group-hover:ring-navy transition-all">
            View <ArrowUpRight size={12} className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </span>
        </div>
      </div>
    </Link>
  )
}
