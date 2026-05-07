import { Camera, Download, ImageOff, Sparkles } from "lucide-react"
import EmptyState from "@/components/dashboard/EmptyState"

const GALLERIES: never[] = []

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
            <span className="inline-flex items-center gap-2"><Camera size={14} className="text-emerald-600" /> Photo galleries coming after each event</span>
            <span className="inline-flex items-center gap-2"><Download size={14} className="text-emerald-600" /> Original-quality downloads</span>
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-5 md:px-8 py-12">
        <EmptyState
          icon={ImageOff}
          title="No galleries yet"
          body="Photo packs will appear here after each event. Check back after the Nyuki Marathon 2026 on 17 May."
        />
      </section>
    </div>
  )
}
