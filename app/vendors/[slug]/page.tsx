import { notFound } from "next/navigation"
import Link from "next/link"
import {
  Star, MapPin, ShieldCheck, Calendar, Clock, Globe, Phone, Mail,
  Check, ArrowUpRight, MessageSquare, Sparkles,
} from "lucide-react"
import { formatCurrency } from "@/lib/utils"
import { getVendorBySlug, VENDOR_VISUAL, VENDORS } from "@/lib/vendors"
import MobileBuyBar from "@/components/MobileBuyBar"
import EnquiryForm from "@/components/vendors/EnquiryForm"

export function generateStaticParams() {
  return VENDORS.map((v) => ({ slug: v.slug }))
}

export default async function VendorProfilePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const vendor = getVendorBySlug(slug)
  if (!vendor) notFound()

  const visual = VENDOR_VISUAL[vendor.category]

  return (
    <div>
      {/* Hero */}
      <section className={`relative overflow-hidden bg-gradient-to-br ${visual.gradient} border-b border-line`}>
        <div className="absolute inset-0 [background:radial-gradient(900px_circle_at_30%_-10%,rgba(255,255,255,0.7),transparent_55%)] pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-5 md:px-8 pt-10 md:pt-16 pb-10 md:pb-14">
          <Link href="/vendors" className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-ink-2 hover:text-ink transition-colors mb-6">
            <span className="opacity-60">←</span> All vendors
          </Link>

          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
            <div className="flex items-start gap-5">
              <div className="shrink-0 inline-flex w-16 h-16 md:w-20 md:h-20 items-center justify-center rounded-2xl bg-paper ring-1 ring-line shadow-sm text-3xl md:text-4xl">
                {visual.emoji}
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span className={`text-[10.5px] font-semibold tracking-[0.18em] uppercase ${visual.accent}`}>
                    {visual.label}
                  </span>
                  {vendor.verified && (
                    <span className="inline-flex items-center gap-1 bg-paper ring-1 ring-line text-ink text-[10.5px] font-semibold tracking-wide px-2 py-0.5 rounded-full">
                      <ShieldCheck size={11} className="text-green-600" /> Verified
                    </span>
                  )}
                </div>
                <h1 className="text-[28px] md:text-[44px] font-bold tracking-[-0.02em] leading-[1.05] text-ink">
                  {vendor.businessName}
                </h1>
                <p className="mt-2 text-[14.5px] md:text-[16px] text-ink-2 max-w-xl">{vendor.tagline}</p>

                <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] text-ink-2">
                  <span className="inline-flex items-center gap-1.5">
                    <Star size={13} className="text-amber-500 fill-amber-500" />
                    <span className="font-semibold text-ink">{vendor.rating.toFixed(1)}</span>
                    <span className="text-ink-3">({vendor.reviewCount} reviews)</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Calendar size={13} className="text-ink-3" />
                    <span className="font-medium text-ink">{vendor.totalEvents}</span>
                    <span className="text-ink-3">events</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-ink-2">
                    <MapPin size={13} className="text-ink-3" /> {vendor.city}
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-ink-2">
                    <Clock size={13} className="text-ink-3" /> Replies in {vendor.responseTimeHours}h
                  </span>
                </div>
              </div>
            </div>

            <div className="hidden md:flex items-center gap-2 shrink-0">
              <Link
                href="#contact"
                className="inline-flex items-center gap-2 rounded-xl border border-line bg-paper px-4 py-3 text-sm font-semibold text-ink hover:border-line-2 transition-colors"
              >
                <MessageSquare size={15} /> Message
              </Link>
              <Link
                href="#packages"
                className="inline-flex items-center gap-2 rounded-xl bg-green-600 px-5 py-3 text-sm font-semibold text-white shadow-sm shadow-green-600/20 hover:bg-green-700 active:scale-[0.99] transition"
              >
                Get a quote <ArrowUpRight size={14} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Body */}
      <div className="max-w-7xl mx-auto px-5 md:px-8 pt-10 md:pt-14 pb-28 lg:pb-14">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          {/* Main column */}
          <div className="lg:col-span-2 space-y-12">
            {/* About */}
            <section>
              <p className="text-[11px] font-semibold tracking-[0.18em] text-blue uppercase mb-2">About</p>
              <h2 className="text-[22px] md:text-[26px] font-bold tracking-tight text-ink mb-4">What we do</h2>
              <p className="text-[15px] leading-relaxed text-ink-2">{vendor.description}</p>

              <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { k: vendor.totalEvents.toString(),     l: "Events delivered" },
                  { k: vendor.rating.toFixed(1),          l: "Avg rating" },
                  { k: `${vendor.responseTimeHours}h`,    l: "Response time" },
                  { k: vendor.serves.length.toString(),   l: "Cities served" },
                ].map((s) => (
                  <div key={s.l} className="rounded-2xl border border-line bg-paper p-4">
                    <p className="text-[22px] font-bold tracking-tight text-ink leading-none">{s.k}</p>
                    <p className="text-[12px] text-ink-3 mt-1.5">{s.l}</p>
                  </div>
                ))}
              </div>

              <div className="mt-6 flex flex-wrap gap-2">
                {vendor.serves.map((c) => (
                  <span key={c} className="inline-flex items-center gap-1.5 text-xs font-medium bg-paper-2 border border-line text-ink-2 px-3 py-1.5 rounded-full">
                    <MapPin size={11} className="text-ink-3" /> {c}
                  </span>
                ))}
              </div>
            </section>

            {/* Packages */}
            <section id="packages">
              <p className="text-[11px] font-semibold tracking-[0.18em] text-blue uppercase mb-2">Packages</p>
              <h2 className="text-[22px] md:text-[26px] font-bold tracking-tight text-ink mb-5">Service options</h2>

              <div className="space-y-3">
                {vendor.packages.map((pkg, i) => (
                  <div
                    key={pkg.id}
                    className={`relative rounded-2xl border bg-paper p-5 md:p-6 transition-all ${
                      i === 1 ? "border-navy/30 shadow-sm shadow-navy/5" : "border-line hover:border-line-2"
                    }`}
                  >
                    {i === 1 && (
                      <span className="absolute -top-2.5 left-5 inline-flex items-center gap-1 bg-navy text-white text-[10px] font-semibold tracking-wide px-2.5 py-1 rounded-full shadow-sm">
                        <Sparkles size={10} /> Most booked
                      </span>
                    )}
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                      <div className="flex-1">
                        <h3 className="text-[17px] font-semibold tracking-tight text-ink">{pkg.name}</h3>
                        <p className="text-[13.5px] text-ink-2 mt-1">{pkg.description}</p>
                        <ul className="mt-4 space-y-1.5">
                          {pkg.bullets.map((b) => (
                            <li key={b} className="flex items-start gap-2 text-[13.5px] text-ink-2">
                              <Check size={14} className="text-green-600 mt-0.5 shrink-0" />
                              <span>{b}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div className="md:text-right shrink-0">
                        <p className="text-[11px] text-ink-3">From</p>
                        <p className="text-[26px] md:text-[28px] font-bold tracking-tight text-ink leading-none">
                          {formatCurrency(pkg.price, pkg.currency)}
                        </p>
                        <button className="mt-3 inline-flex items-center justify-center gap-1.5 rounded-lg bg-green-600 text-white text-sm font-semibold px-4 py-2.5 hover:bg-green-700 transition-colors w-full md:w-auto">
                          Request <ArrowUpRight size={13} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Portfolio */}
            <section>
              <p className="text-[11px] font-semibold tracking-[0.18em] text-blue uppercase mb-2">Portfolio</p>
              <h2 className="text-[22px] md:text-[26px] font-bold tracking-tight text-ink mb-5">Recent events</h2>

              <ul className="divide-y divide-line rounded-2xl border border-line bg-paper">
                {vendor.portfolio.map((p) => (
                  <li key={p.title} className="flex items-center gap-4 p-5">
                    <div className={`shrink-0 inline-flex w-10 h-10 items-center justify-center rounded-xl bg-gradient-to-br ${visual.gradient} ring-1 ring-line text-lg`}>
                      {visual.emoji}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[14.5px] font-semibold tracking-tight text-ink truncate">{p.title}</p>
                      <p className="text-[12.5px] text-ink-3 mt-0.5">{p.venue}</p>
                    </div>
                    <span className="text-[12px] font-medium text-ink-2 bg-paper-2 border border-line px-2.5 py-1 rounded-md">
                      {p.year}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          {/* Sticky aside */}
          <aside className="lg:col-span-1">
            <div id="contact" className="lg:sticky lg:top-24 rounded-2xl border border-line bg-paper p-6 shadow-sm shadow-ink/[0.04] scroll-mt-24">
              <EnquiryForm
                vendorSlug={vendor.slug}
                vendorId={vendor.id ?? vendor.slug}
                vendorName={vendor.businessName}
                responseTimeHours={vendor.responseTimeHours}
              />

              <div className="border-t border-line pt-5 space-y-2.5">
                <div className="flex items-center gap-2.5 text-[12.5px] text-ink-2">
                  <Phone size={13} className="text-ink-3" />
                  <span className="text-ink font-medium">+263 77 hidden, sign in to view</span>
                </div>
                <div className="flex items-center gap-2.5 text-[12.5px] text-ink-2">
                  <Mail size={13} className="text-ink-3" />
                  <span className="text-ink font-medium">Sign in to view</span>
                </div>
                <div className="flex items-center gap-2.5 text-[12.5px] text-ink-2">
                  <Globe size={13} className="text-ink-3" />
                  <span>Public profile · ticketpulse.co.zw/v/{vendor.slug}</span>
                </div>
              </div>

              <div className="mt-5 rounded-xl bg-paper-2 border border-line p-3.5 flex items-start gap-2.5">
                <ShieldCheck size={15} className="text-green-600 mt-0.5 shrink-0" />
                <p className="text-[12px] leading-relaxed text-ink-2">
                  All payments are held by TicketPulse and released to the vendor on event completion. Refundable if cancelled within terms.
                </p>
              </div>
            </div>
          </aside>
        </div>
      </div>

      <MobileBuyBar
        label="Get a quote"
        primary={formatCurrency(vendor.priceFrom, vendor.currency)}
        secondary="From"
        href="#contact"
      />
    </div>
  )
}
