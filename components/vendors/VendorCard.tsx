import Link from "next/link"
import { Star, MapPin, ShieldCheck, ArrowUpRight } from "lucide-react"
import { formatCurrency } from "@/lib/utils"
import { VENDOR_VISUAL, type VendorProfile } from "@/lib/vendors"

interface VendorCardProps {
  vendor: VendorProfile
}

export default function VendorCard({ vendor }: VendorCardProps) {
  const visual = VENDOR_VISUAL[vendor.category]

  return (
    <Link
      href={`/vendors/${vendor.slug}`}
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-line bg-paper transition-all duration-200 hover:-translate-y-0.5 hover:border-line-2 hover:shadow-[0_12px_40px_-12px_rgba(10,37,64,0.18)]"
    >
      <div className={`relative h-32 bg-gradient-to-br ${visual.gradient} flex items-center justify-center overflow-hidden`}>
        <div className="absolute inset-0 [background:radial-gradient(600px_circle_at_30%_20%,rgba(255,255,255,0.65),transparent_60%)] pointer-events-none" />
        <span className="text-4xl relative">{visual.emoji}</span>
        {vendor.verified && (
          <span className="absolute top-3 left-3 inline-flex items-center gap-1 bg-white/90 backdrop-blur ring-1 ring-line text-ink text-[10px] font-semibold tracking-wide px-2 py-1 rounded-full">
            <ShieldCheck size={11} className="text-brand-600" /> Verified
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-center gap-2 mb-2">
          <span className={`text-[10.5px] font-semibold tracking-[0.16em] uppercase ${visual.accent}`}>
            {visual.label}
          </span>
        </div>

        <h3 className="text-[16px] font-semibold leading-snug tracking-tight text-ink mb-1.5 line-clamp-1 group-hover:text-navy-700 transition-colors">
          {vendor.businessName}
        </h3>
        <p className="text-[13px] text-ink-2 line-clamp-2 mb-4">{vendor.tagline}</p>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[12.5px] text-ink-2 mb-4">
          <span className="inline-flex items-center gap-1">
            <Star size={12} className="text-amber-500 fill-amber-500" />
            <span className="font-semibold text-ink">{vendor.rating.toFixed(1)}</span>
            <span className="text-ink-3">({vendor.reviewCount})</span>
          </span>
          <span className="text-ink-3">·</span>
          <span className="text-ink-3">{vendor.totalEvents} events</span>
          <span className="text-ink-3">·</span>
          <span className="inline-flex items-center gap-1 text-ink-2">
            <MapPin size={11} className="text-ink-3" />
            {vendor.city}
          </span>
        </div>

        <div className="mt-auto flex items-center justify-between pt-4 border-t border-line">
          <div>
            <span className="text-[11px] text-ink-3">From</span>
            <span className="ml-1.5 text-[15px] font-semibold tracking-tight text-ink">
              {formatCurrency(vendor.priceFrom, vendor.currency)}
            </span>
          </div>
          <span className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-navy group-hover:gap-1.5 transition-all">
            View <ArrowUpRight size={13} />
          </span>
        </div>
      </div>
    </Link>
  )
}
