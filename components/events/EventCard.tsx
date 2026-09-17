import Link from "next/link"
import { Activity, ArrowUpRight, Building2, Calendar, Film, Flame, Footprints, MapPin, Mountain, Music2, Ticket as TicketIcon, type LucideIcon } from "lucide-react"
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
  sponsored?: boolean
  lowestPrice?: number | null
  currency?: string
  status?: string
  soldQuantity?: number
  totalQuantity?: number
  isPast?: boolean
  tags?: string[] | null
}

interface CategoryVisual {
  gradient: string
  icon: LucideIcon
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
  concert:    { gradient: "from-violet-100 via-fuchsia-50 to-pink-50",  icon: Music2,     tint: "text-violet-700", ring: "ring-violet-200/60", pattern: PATTERNS.concert },
  marathon:   { gradient: "from-sky-100 via-blue-50 to-cyan-50",        icon: Activity,   tint: "text-sky-700",    ring: "ring-sky-200/60",    pattern: PATTERNS.marathon },
  walkathon:  { gradient: "from-green-100 via-teal-50 to-cyan-50",      icon: Footprints, tint: "text-green-700",  ring: "ring-green-200/60",  pattern: PATTERNS.walkathon },
  film:       { gradient: "from-amber-100 via-orange-50 to-rose-50",    icon: Film,       tint: "text-amber-700",  ring: "ring-amber-200/60",  pattern: PATTERNS.film },
  exhibition: { gradient: "from-slate-100 via-blue-50 to-indigo-50",   icon: Building2,  tint: "text-slate-700",  ring: "ring-slate-200/60",  pattern: PATTERNS.exhibition },
  expedition: { gradient: "from-lime-100 via-green-50 to-teal-50",     icon: Mountain,   tint: "text-green-800",  ring: "ring-lime-200/60",   pattern: PATTERNS.expedition },
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
  coverImage, featured, sponsored, lowestPrice, currency = "USD", status,
  isPast, tags,
}: EventCardProps) {
  const visual = CATEGORY_VISUAL[category.toLowerCase()] ?? {
    gradient: "from-slate-100 to-slate-50",
    icon: TicketIcon,
    tint: "text-slate-700",
    ring: "ring-slate-200/60",
    pattern: PATTERNS.default,
  }

  const date = startsAt instanceof Date ? startsAt : new Date(startsAt)
  const remaining = timeUntil(date)
  const soldOut = status === "sold_out"
  const sellingFast = tags?.includes("selling-fast") ?? title.trim().toLowerCase() === "shenergy"
  const CategoryIcon = visual.icon

  return (
    <Link
      href={`/events/${slug}`}
      className="tp-premium-card group relative flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-white transition-all duration-300 hover:-translate-y-1 hover:border-orange-200 hover:shadow-[0_24px_60px_-28px_rgba(201,82,42,0.34)]"
    >
      <span className="pointer-events-none absolute inset-x-5 top-0 z-20 h-px bg-gradient-to-r from-transparent via-orange-300/80 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" aria-hidden />
      {/* Category header */}
      <div className={`relative h-44 sm:h-48 overflow-hidden ${coverImage ? "bg-navy" : `bg-gradient-to-br ${visual.gradient}`}`}>
        {coverImage ? (
          <>
            {/* Cover image */}
            <img
              src={coverImage}
              alt={`${title} — ${venue}, ${city}`}
              loading="lazy"
              className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.08]"
            />
            {/* Dark overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/72 via-black/24 to-black/5" />
            <div className="absolute inset-0 bg-[radial-gradient(420px_circle_at_18%_12%,rgba(249,115,22,0.24),transparent_45%)] opacity-80 transition-opacity duration-300 group-hover:opacity-100" />
            {/* Hover shine */}
            <div className="absolute inset-0 bg-gradient-to-t from-paper/0 via-transparent to-paper/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
            {/* Category label */}
            <span className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-semibold tracking-wide text-white backdrop-blur-sm ring-1 ring-white/20">
              <CategoryIcon size={12} strokeWidth={2.3} /> {category}
            </span>
          </>
        ) : (
          <>
            {/* Decorative pattern */}
            {visual.pattern}

            {/* Light wash */}
            <div className="absolute inset-0 [background:radial-gradient(800px_circle_at_30%_25%,rgba(255,255,255,0.7),transparent_60%)] pointer-events-none" />

            {/* Soft diagonal depth */}
            <div className="absolute inset-y-0 right-0 w-1/2 skew-x-[-14deg] bg-white/28 pointer-events-none" />

            {/* Hover shine */}
            <div className="absolute inset-0 bg-gradient-to-t from-paper/0 via-transparent to-paper/30 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

            {/* Category icon */}
            <div className="absolute inset-0 flex items-center justify-center">
              <span className={`inline-flex h-20 w-20 items-center justify-center rounded-[28px] bg-white/55 ${visual.tint} shadow-sm ring-1 ${visual.ring} backdrop-blur-sm transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-3`}>
                <CategoryIcon size={38} strokeWidth={1.7} />
              </span>
            </div>
          </>
        )}

        {/* Top-left: status */}
        {isPast ? (
            <span className="absolute top-3 left-3 rounded-full bg-ink px-2.5 py-1 text-[10px] font-bold text-white shadow-sm">
            PAST EVENT
          </span>
        ) : sponsored ? (
          <span className="absolute top-3 left-3 inline-flex items-center gap-1.5 bg-gradient-to-r from-amber-500 to-yellow-400 text-white text-[10px] font-bold px-2.5 py-1 rounded-full shadow-sm shadow-amber-600/25 ring-1 ring-white/20">
            <span className="w-1 h-1 rounded-full bg-white" /> SPONSORED
          </span>
        ) : sellingFast && !soldOut && status === "published" ? (
          <span className="absolute top-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-orange-600 to-rose-600 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm shadow-orange-900/25 ring-1 ring-white/20">
            <Flame size={11} className="tp-flame-pulse fill-white/25" /> Tickets selling fast
          </span>
        ) : featured && !soldOut && (
          <span className="absolute top-3 left-3 inline-flex items-center gap-1.5 bg-navy text-white text-[10px] font-semibold tracking-wide px-2.5 py-1 rounded-full shadow-sm shadow-brand-600/20">
            <span className="w-1 h-1 rounded-full bg-white" /> FEATURED
          </span>
        )}
        {!isPast && soldOut && (
          <span className="absolute top-3 left-3 bg-rose-600 text-white text-[10px] font-bold px-2.5 py-1 rounded-full shadow-sm">
            SOLD OUT
          </span>
        )}
        {!isPast && !featured && !soldOut && status === "published" && (
          <span className="absolute top-3 left-3 rounded-full bg-orange-600 px-2.5 py-1 text-[10px] font-semibold text-white shadow-sm shadow-orange-900/20">
            ON SALE
          </span>
        )}

        {/* Top-right: time-until or trending */}
        {!isPast && remaining && (
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
      <div className="flex flex-1 flex-col p-4 sm:p-5">
        <p className={`mb-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] ${visual.tint}`}>{category}</p>

        <h3 className="mb-2.5 min-h-[2.75rem] line-clamp-2 text-[17px] font-semibold leading-snug tracking-[-0.01em] text-ink transition-colors group-hover:text-navy-700">
          {title}
        </h3>

        <div className="mb-3.5 space-y-1.5">
          <div className="flex items-center gap-2 text-[13px] text-ink-2">
            <Calendar size={13} className="text-ink-3 shrink-0" />
            <span>{formatDateShort(date)}</span>
          </div>
          <div className="flex items-center gap-2 text-[13px] text-ink-2">
            <MapPin size={13} className="text-ink-3 shrink-0" />
            <span className="truncate">
              {venue.trim().toLowerCase() === "tba" || city.trim().toLowerCase() === "tba"
                ? "Location TBA"
                : `${venue}, ${city}`}
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-auto flex items-center justify-between border-t border-line pt-3.5">
          <div>
            {isPast ? (
              <span className="text-[13px] font-semibold text-ink-2">Event ended</span>
            ) : lowestPrice != null ? (
              <>
                <span className="text-[11px] text-ink-3">From</span>
                <span className="ml-1.5 text-[23px] font-bold tracking-[-0.02em] text-accent sm:text-[25px]">
                  {formatCurrency(lowestPrice, currency)}
                </span>
              </>
            ) : (
              <span className="text-[13px] font-semibold text-green-700">Free entry</span>
            )}
          </div>
          <span className="inline-flex h-10 min-w-[118px] items-center justify-center gap-2 rounded-sm border border-line-2 bg-paper px-4 text-[11px] font-bold uppercase tracking-[0.08em] text-navy shadow-sm transition-all group-hover:border-orange-600 group-hover:bg-orange-600 group-hover:text-white group-hover:shadow-orange-900/15">
            {isPast ? "Summary" : "Buy tickets"} <ArrowUpRight size={13} strokeWidth={2.2} className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </span>
        </div>
      </div>
    </Link>
  )
}
