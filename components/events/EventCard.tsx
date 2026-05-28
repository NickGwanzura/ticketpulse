import Link from "next/link"
import { formatCurrency } from "@/lib/utils"

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

const CATEGORY_EMOJI: Record<string, string> = {
  concert: "🎵",
  marathon: "🏃",
  walkathon: "🚶",
  film: "🎬",
  exhibition: "🏢",
  expedition: "⛰️",
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

function formatDateLine(date: Date): string {
  const d = date.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })
  const t = date.toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit" })
  return `${d.toUpperCase()} · ${t}`
}

export default function EventCard({
  slug, title, category, venue, city, startsAt,
  coverImage, lowestPrice, currency = "USD", status,
  soldQuantity, totalQuantity,
}: EventCardProps) {
  const emoji = CATEGORY_EMOJI[category.toLowerCase()] ?? "🎫"

  const date = startsAt instanceof Date ? startsAt : new Date(startsAt)
  const remaining = timeUntil(date)
  const going = soldQuantity ?? 0
  const capacity = totalQuantity ?? 0
  const pct = capacity > 0 ? Math.min(100, Math.round((going / capacity) * 100)) : 0
  const soldOut = status === "sold_out" || pct >= 100

  return (
    <Link
      href={`/events/${slug}`}
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-line bg-paper transition-all duration-300 hover:border-line-2 hover:shadow-[0_12px_40px_-16px_rgba(11,15,25,0.18)]"
    >
      {/* Image / placeholder */}
      <div className={`relative h-40 overflow-hidden border-b border-line ${coverImage ? "bg-navy" : "bg-paper-2"}`}>
        {coverImage ? (
          <>
            <img
              src={coverImage}
              alt=""
              loading="lazy"
              className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
          </>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-5xl opacity-90 transition-transform duration-300 group-hover:scale-110">{emoji}</span>
          </div>
        )}

        {/* Category badge */}
        <span className={`absolute top-3 left-3 inline-flex items-center text-[11px] font-semibold px-2.5 py-1 rounded-md capitalize ${
          coverImage
            ? "bg-white/15 text-white backdrop-blur-sm ring-1 ring-white/20"
            : "bg-paper text-ink-2 border border-line"
        }`}>
          {category}
        </span>

        {/* Status / urgency badge */}
        {soldOut ? (
          <span className="absolute top-3 right-3 text-[11px] font-semibold text-white bg-ink px-2.5 py-1 rounded-md">Sold out</span>
        ) : pct >= 80 ? (
          <span className="absolute top-3 right-3 text-[11px] font-semibold text-white bg-ink px-2.5 py-1 rounded-md">Selling fast</span>
        ) : remaining && remaining.kind === "soon" ? (
          <span className="absolute top-3 right-3 text-[11px] font-semibold text-brand bg-brand-50 px-2.5 py-1 rounded-md">{remaining.label}</span>
        ) : null}
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col p-5">
        <p className="text-[12px] font-semibold text-brand tabular-nums">{formatDateLine(date)}</p>

        <h3 className="text-[16px] font-semibold leading-snug tracking-tight text-ink mt-1.5 line-clamp-2 group-hover:text-brand transition-colors">
          {title}
        </h3>

        <p className="text-[13.5px] text-ink-3 mt-1.5 truncate">{venue}, {city}</p>

        {/* Footer */}
        <div className="mt-auto flex items-center justify-between pt-4 border-t border-line">
          {lowestPrice != null ? (
            <span className="text-[14px] font-semibold text-ink">
              <span className="text-ink-3 font-normal">from </span>{formatCurrency(lowestPrice, currency)}
            </span>
          ) : (
            <span className="text-[14px] font-semibold text-brand">Free entry</span>
          )}
          <span className="text-[12px] text-ink-3">
            {soldOut ? "Sold out" : pct > 0 ? `${pct}% sold` : remaining ? remaining.label : "On sale"}
          </span>
        </div>
      </div>
    </Link>
  )
}
