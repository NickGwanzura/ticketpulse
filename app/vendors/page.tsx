import Link from "next/link"
import { Search, ShieldCheck, Sparkles, ArrowRight, SearchX } from "lucide-react"
import VendorCard from "@/components/vendors/VendorCard"
import EmptyState from "@/components/dashboard/EmptyState"
import { VENDORS, VENDOR_VISUAL } from "@/lib/vendors"
import type { VendorCategory } from "@/types"

const CATEGORIES: { label: string; value: "all" | VendorCategory }[] = [
  { label: "All",         value: "all" },
  { label: "Catering",    value: "catering" },
  { label: "Bar service", value: "bar" },
  { label: "Food trucks", value: "food_truck" },
  { label: "Photography", value: "photography" },
  { label: "Sound & AV",  value: "sound" },
  { label: "Security",    value: "security" },
  { label: "Decor",       value: "decor" },
]

export default async function VendorsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; q?: string; verified?: string }>
}) {
  const sp = await searchParams
  const activeCategory = (sp.category ?? "all") as "all" | VendorCategory
  const query = (sp.q ?? "").trim().toLowerCase()
  const verifiedOnly = sp.verified === "1"

  const filtered = VENDORS.filter((v) => {
    if (activeCategory !== "all" && v.category !== activeCategory) return false
    if (verifiedOnly && !v.verified) return false
    if (query) {
      const haystack = `${v.businessName} ${v.city} ${v.tagline} ${v.serves.join(" ")}`.toLowerCase()
      if (!haystack.includes(query)) return false
    }
    return true
  })

  const verifiedCount = VENDORS.filter((v) => v.verified).length
  const cityCount = new Set(VENDORS.flatMap((v) => v.serves)).size

  return (
    <div className="tp-fade-up">
      {/* Header */}
      <section className="relative overflow-hidden border-b border-line">
        <div
          className="absolute inset-0 -z-10"
          style={{
            background:
              "radial-gradient(1000px 360px at 80% -20%, #DBE8FB 0%, transparent 55%), linear-gradient(180deg, #FFFFFF 0%, #F6F9FC 100%)",
          }}
        />
        <div className="max-w-7xl mx-auto px-5 md:px-8 pt-12 md:pt-20 pb-10 md:pb-14">
          <div className="inline-flex items-center gap-2 rounded-full border border-line bg-paper/80 backdrop-blur px-3 py-1.5 mb-6 shadow-sm shadow-ink/5">
            <Sparkles size={13} className="text-blue" />
            <span className="text-[11px] font-semibold tracking-[0.16em] text-ink uppercase">Marketplace</span>
          </div>

          <h1 className="text-[36px] md:text-[60px] font-bold tracking-[-0.025em] leading-[1.04] text-ink max-w-3xl">
            Trusted vendors. <span className="text-blue">Booked direct.</span>
          </h1>
          <p className="mt-4 md:mt-5 text-[15px] md:text-[18px] leading-relaxed text-ink-2 max-w-xl">
            Catering, photography, sound, security and more, verified by TicketPulse, rated by organizers across Zimbabwe.
          </p>

          {/* Quick stats */}
          <div className="mt-8 grid grid-cols-3 max-w-md gap-4">
            <div>
              <p className="text-[22px] md:text-[26px] font-bold tracking-tight text-ink leading-none">{VENDORS.length}+</p>
              <p className="text-[12.5px] text-ink-3 mt-1.5">Active vendors</p>
            </div>
            <div>
              <p className="text-[22px] md:text-[26px] font-bold tracking-tight text-ink leading-none">{verifiedCount}</p>
              <p className="text-[12.5px] text-ink-3 mt-1.5">Verified</p>
            </div>
            <div>
              <p className="text-[22px] md:text-[26px] font-bold tracking-tight text-ink leading-none">{cityCount}</p>
              <p className="text-[12.5px] text-ink-3 mt-1.5">Cities served</p>
            </div>
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-5 md:px-8 py-8 md:py-10">
        {/* Search & verified */}
        <form className="flex flex-col md:flex-row gap-3 mb-6">
          <div className="relative flex-1 max-w-xl">
            <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-3 pointer-events-none" />
            <input
              type="text"
              name="q"
              placeholder="Search vendors, cities, services…"
              defaultValue={query}
              className="w-full h-12 rounded-xl border border-line bg-paper pl-11 pr-4 text-sm text-ink placeholder:text-ink-3 shadow-sm shadow-ink/[0.03] focus:outline-none focus:border-blue focus:ring-4 focus:ring-blue/10 transition"
            />
          </div>
          {activeCategory !== "all" && (
            <input type="hidden" name="category" value={activeCategory} />
          )}
          <label
            className={`inline-flex items-center justify-center gap-2 h-12 rounded-xl border px-4 text-sm font-medium cursor-pointer transition-colors select-none ${
              verifiedOnly
                ? "bg-blue-soft border-blue/30 text-blue"
                : "bg-paper border-line text-ink-2 hover:text-ink hover:border-line-2"
            }`}
          >
            <input
              type="checkbox"
              name="verified"
              value="1"
              defaultChecked={verifiedOnly}
              className="sr-only"
            />
            <ShieldCheck size={15} className={verifiedOnly ? "text-blue" : "text-emerald-600"} />
            Verified only
          </label>
          <button
            type="submit"
            className="hidden md:inline-flex items-center justify-center h-12 rounded-xl bg-navy px-5 text-sm font-semibold text-white shadow-sm shadow-navy/20 hover:bg-navy-700 transition-colors"
          >
            Apply
          </button>
        </form>

        {/* Category chips */}
        <div className="flex gap-2 mb-8 flex-wrap">
          {CATEGORIES.map((cat) => {
            const isActive = activeCategory === cat.value
            const params = new URLSearchParams()
            if (cat.value !== "all") params.set("category", cat.value)
            if (query) params.set("q", query)
            if (verifiedOnly) params.set("verified", "1")
            const href = `/vendors${params.toString() ? `?${params.toString()}` : ""}`
            return (
              <Link
                key={cat.value}
                href={href}
                className={`text-sm px-4 py-2 rounded-full border transition-all ${
                  isActive
                    ? "bg-navy text-white border-navy shadow-sm shadow-navy/20"
                    : "border-line bg-paper text-ink-2 hover:text-ink hover:border-line-2"
                }`}
              >
                {cat.label}
              </Link>
            )
          })}
        </div>

        {/* Result count */}
        <p className="text-xs text-ink-3 mb-5">
          {filtered.length} {filtered.length === 1 ? "vendor" : "vendors"} found
          {activeCategory !== "all" && ` in ${VENDOR_VISUAL[activeCategory].label.toLowerCase()}`}
        </p>

        {/* Grid */}
        {filtered.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6 tp-fade-up-1">
            {filtered.map((vendor) => (
              <VendorCard key={vendor.slug} vendor={vendor} />
            ))}
          </div>
        ) : VENDORS.length === 0 ? (
          <EmptyState
            icon={SearchX}
            title="Vendor catalogue coming soon"
            body="We're onboarding vendors for the Nyuki Marathon 2026 and beyond. Apply below to be first in the catalogue."
          />
        ) : (
          <EmptyState
            icon={SearchX}
            title="No vendors match those filters"
            body="Try clearing the search or picking a different category."
            ctaLabel="See all vendors"
            ctaHref="/vendors"
          />
        )}
      </div>

      {/* Become a vendor CTA */}
      <section className="px-5 md:px-8 pb-20 md:pb-24">
        <div className="max-w-7xl mx-auto">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-navy via-navy-700 to-navy text-white p-8 md:p-12">
            <div className="absolute -top-32 -right-24 w-96 h-96 rounded-full bg-blue/30 blur-3xl pointer-events-none" />
            <div
              className="absolute inset-0 opacity-[0.07]"
              style={{
                backgroundImage:
                  "linear-gradient(to right, #ffffff20 1px, transparent 1px), linear-gradient(to bottom, #ffffff20 1px, transparent 1px)",
                backgroundSize: "32px 32px",
              }}
              aria-hidden
            />
            <div className="relative grid md:grid-cols-2 gap-8 items-center">
              <div>
                <p className="text-[11px] font-semibold tracking-[0.18em] text-white/70 uppercase mb-3">For vendors</p>
                <h2 className="text-[26px] md:text-[36px] font-bold tracking-tight leading-[1.1]">
                  Get booked by Zimbabwe&apos;s biggest organizers.
                </h2>
                <p className="mt-3 text-[15px] md:text-[16px] leading-relaxed text-white/80 max-w-md">
                  List your service, set your packages, and get matched with events across Harare, Bulawayo, Vic Falls and beyond. We handle payouts.
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <Link
                    href="/vendors/apply"
                    className="inline-flex items-center gap-2 rounded-xl bg-white text-navy font-semibold px-5 py-3.5 text-sm hover:bg-paper-2 active:scale-[0.99] transition"
                  >
                    Apply to list <ArrowRight size={15} />
                  </Link>
                  <Link
                    href="/help/vendors"
                    className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/5 text-white font-semibold px-5 py-3.5 text-sm hover:bg-white/10 transition"
                  >
                    How payouts work
                  </Link>
                </div>
              </div>
              <ul className="grid grid-cols-2 gap-3">
                {[
                  ["Direct bookings", "No middleman, no markup. Organizers find you."],
                  ["Verified payouts", "USD, ZAR, EcoCash. Cleared on event completion."],
                  ["Profile boost", "Verified badge after your first 5 paid events."],
                  ["Calendar sync", "Avoid double bookings with our event calendar."],
                ].map(([title, body]) => (
                  <li key={title} className="rounded-2xl bg-white/[0.06] border border-white/10 p-4 backdrop-blur">
                    <p className="text-[13px] font-semibold tracking-tight">{title}</p>
                    <p className="text-[12px] text-white/70 mt-1.5 leading-relaxed">{body}</p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
