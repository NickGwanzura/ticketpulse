import Link from "next/link"
import { Camera, Download, Sparkles, ArrowRight } from "lucide-react"
import { formatCurrency } from "@/lib/utils"

const GALLERIES = [
  { id: "1", slug: "nyuki-marathon-2025",   title: "Nyuki Marathon 2025", venue: "National Sports Stadium", photos: 1240, packPrice: 3, currency: "USD", gradient: "from-sky-100 via-blue-50 to-cyan-50",        emoji: "🏃" },
  { id: "2", slug: "rumble-in-sa-2024",     title: "Rumble in SA 2024",   venue: "Sun Arena Pretoria",      photos: 860,  packPrice: 5, currency: "USD", gradient: "from-violet-100 via-fuchsia-50 to-pink-50", emoji: "🎵" },
  { id: "3", slug: "hifa-2024",             title: "HIFA 2024",           venue: "Harare Gardens",          photos: 2110, packPrice: 4, currency: "USD", gradient: "from-amber-100 via-orange-50 to-rose-50",  emoji: "🎬" },
  { id: "4", slug: "vic-falls-carnival-2024", title: "Vic Falls Carnival 2024", venue: "Elephant Hills",   photos: 540,  packPrice: 4, currency: "USD", gradient: "from-emerald-100 via-teal-50 to-cyan-50",   emoji: "⛰️" },
  { id: "5", slug: "becoming-madam-boss-premiere", title: "Becoming Madam Boss",  venue: "Ster-Kinekor",  photos: 320,  packPrice: 3, currency: "USD", gradient: "from-amber-100 via-orange-50 to-rose-50",   emoji: "🎬" },
  { id: "6", slug: "bulawayo-arts-awards-2025",   title: "Bulawayo Arts Awards 2025", venue: "Bulawayo Theatre", photos: 410, packPrice: 3, currency: "USD", gradient: "from-pink-100 via-rose-50 to-fuchsia-50",   emoji: "🎭" },
]

export default function MediaPage() {
  return (
    <div>
      <section className="relative overflow-hidden border-b border-line">
        <div className="absolute inset-0 -z-10" style={{ background: "radial-gradient(900px 360px at 80% -20%, #DBE8FB 0%, transparent 55%), linear-gradient(180deg, #FFFFFF 0%, #F6F9FC 100%)" }} />
        <div className="max-w-7xl mx-auto px-5 md:px-8 pt-14 md:pt-20 pb-10 md:pb-14">
          <div className="inline-flex items-center gap-2 rounded-full border border-line bg-paper/80 backdrop-blur px-3 py-1.5 mb-6 shadow-sm shadow-ink/5">
            <Sparkles size={13} className="text-blue" />
            <span className="text-[11px] font-semibold tracking-[0.16em] text-ink uppercase">Photo gallery</span>
          </div>
          <h1 className="text-[36px] md:text-[56px] font-bold tracking-[-0.025em] leading-[1.04] text-ink max-w-3xl">
            Find yourself in the crowd.
          </h1>
          <p className="mt-5 text-[16px] md:text-[18px] text-ink-2 max-w-xl leading-relaxed">
            High-resolution photo packs from every TicketPulse event. Free to browse, pay only if you want to download.
          </p>

          <div className="mt-8 flex flex-wrap gap-x-8 gap-y-3 text-[12.5px] text-ink-3">
            <span className="inline-flex items-center gap-2"><Camera size={14} className="text-emerald-600" /> {GALLERIES.reduce((s, g) => s + g.photos, 0).toLocaleString()} photos</span>
            <span className="inline-flex items-center gap-2"><Download size={14} className="text-emerald-600" /> Original-quality downloads</span>
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-5 md:px-8 py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6">
          {GALLERIES.map((g) => (
            <Link
              key={g.id}
              href={`/media/${g.slug}`}
              className="group relative overflow-hidden rounded-2xl border border-line bg-paper hover:-translate-y-0.5 hover:border-line-2 hover:shadow-[0_12px_40px_-12px_rgba(10,37,64,0.18)] transition-all"
            >
              <div className={`relative h-48 bg-gradient-to-br ${g.gradient} flex items-center justify-center overflow-hidden`}>
                <div className="absolute inset-0 [background:radial-gradient(800px_circle_at_30%_20%,rgba(255,255,255,0.6),transparent_60%)]" />
                <span className="text-6xl relative">{g.emoji}</span>
                <span className="absolute top-3 left-3 inline-flex items-center gap-1 bg-paper/90 backdrop-blur ring-1 ring-line text-ink text-[10.5px] font-semibold tracking-wide px-2 py-1 rounded-full">
                  <Camera size={11} /> {g.photos.toLocaleString()}
                </span>
              </div>
              <div className="p-5">
                <h3 className="text-[16px] font-semibold leading-snug tracking-tight text-ink mb-1 group-hover:text-navy-700 transition-colors">{g.title}</h3>
                <p className="text-[12.5px] text-ink-3">{g.venue}</p>
                <div className="mt-4 pt-4 border-t border-line flex items-center justify-between">
                  <div>
                    <span className="text-[11px] text-ink-3">Pack from</span>
                    <span className="ml-1.5 text-[15px] font-semibold tracking-tight text-ink">{formatCurrency(g.packPrice, g.currency)}</span>
                  </div>
                  <span className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-navy">
                    Browse <ArrowRight size={12} />
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}
