import { redirect } from "next/navigation"
import Link from "next/link"
import { eq } from "drizzle-orm"
import { BadgeCheck, ExternalLink, Pencil, Star } from "lucide-react"

import { auth } from "@/auth"
import { db } from "@/db"
import { vendors } from "@/db/schema"
import { vendorCategoryLabel } from "@/lib/utils"
import { VENDOR_VISUAL } from "@/lib/vendors"
import VendorDashboardForm from "./VendorDashboardForm"

export const dynamic = "force-dynamic"

export default async function VendorDashboardPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/auth/signin?callbackUrl=/vendors/dashboard")

  const [vendor] = await db.select().from(vendors).where(eq(vendors.userId, session.user.id)).limit(1)
  if (!vendor) redirect("/vendors/apply")

  const visual = VENDOR_VISUAL[vendor.category] ?? VENDOR_VISUAL.other
  const Icon = visual.icon
  const portfolio = (vendor.portfolio ?? []) as string[]

  // Profile completeness score
  const fields = [
    !!vendor.businessName,
    !!vendor.description && vendor.description.length > 30,
    !!vendor.phone,
    !!vendor.email,
    !!vendor.city,
    !!vendor.priceRange,
    !!vendor.logo,
    portfolio.length > 0,
  ]
  const complete = fields.filter(Boolean).length
  const total = fields.length
  const pct = Math.round((complete / total) * 100)

  const missingFields = [
    !vendor.description || vendor.description.length <= 30 ? "Add a description (30+ chars)" : null,
    !vendor.phone ? "Add a phone number" : null,
    !vendor.email ? "Add a contact email" : null,
    !vendor.city ? "Add your city" : null,
    !vendor.priceRange ? "Add a price range" : null,
    !vendor.logo ? "Upload a logo" : null,
    portfolio.length === 0 ? "Upload portfolio photos" : null,
  ].filter(Boolean) as string[]

  return (
    <div className="tp-fade-up">
      {/* Header */}
      <div className="border-b border-line bg-paper">
        <div className="max-w-5xl mx-auto px-5 md:px-8 py-8 md:py-10">
          <div className="flex items-start gap-4">
            <span className={`shrink-0 inline-flex w-12 h-12 items-center justify-center rounded-2xl bg-paper ring-1 ${visual.ring}`}>
              <Icon size={20} className={visual.accent} />
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-semibold tracking-[0.16em] text-ink-3 uppercase mb-1.5">Vendor profile</p>
              <div className="flex flex-wrap items-center gap-2.5 mb-1">
                <h1 className="text-[24px] md:text-[28px] font-bold tracking-tight text-ink leading-none">
                  {vendor.businessName}
                </h1>
                {vendor.verified && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-semibold px-2.5 py-1">
                    <BadgeCheck size={12} strokeWidth={2.5} /> Verified
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2 text-[12.5px] text-ink-2">
                <span>{vendorCategoryLabel(vendor.category)}</span>
                {vendor.city && <><span className="text-ink-3">·</span><span>{vendor.city}</span></>}
                {vendor.rating && (
                  <><span className="text-ink-3">·</span>
                  <span className="inline-flex items-center gap-1">
                    <Star size={11} className="text-amber-400 fill-amber-400" />
                    {Number(vendor.rating).toFixed(1)}
                  </span></>
                )}
              </div>
            </div>
            <Link href={`/vendors/${vendor.id}`} target="_blank"
              className="shrink-0 inline-flex items-center gap-1.5 rounded-xl border border-line bg-paper px-3 py-2 text-[12.5px] font-medium text-ink hover:border-line-2 transition-colors">
              <ExternalLink size={13} /> View listing
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-5 md:px-8 py-8 space-y-8">

        {/* Profile completeness */}
        {pct < 100 && (
          <div className="rounded-2xl border border-line bg-paper p-5 tp-fade-up-1">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-[13.5px] font-semibold text-ink">Profile completeness</p>
                <p className="text-[12px] text-ink-3 mt-0.5">Complete profiles get shortlisted 3× more often</p>
              </div>
              <span className="text-[22px] font-bold tabular-nums text-ink">{pct}%</span>
            </div>
            <div className="h-2 bg-paper-3 rounded-full overflow-hidden mb-4">
              <div
                className={`h-full rounded-full transition-all ${pct >= 80 ? "bg-emerald-500" : pct >= 50 ? "bg-amber-500" : "bg-rose-500"}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            {missingFields.length > 0 && (
              <ul className="space-y-1">
                {missingFields.slice(0, 4).map(f => (
                  <li key={f} className="flex items-center gap-2 text-[12px] text-ink-2">
                    <Pencil size={11} className="text-ink-3 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {pct === 100 && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 flex items-center gap-3 tp-fade-up-1">
            <BadgeCheck size={16} className="text-emerald-600 shrink-0" />
            <p className="text-[13px] font-semibold text-emerald-800">Profile complete. Organizers can find and book you.</p>
          </div>
        )}

        {/* Profile editor */}
        <div className="tp-fade-up-2">
          <h2 className="text-[17px] font-semibold text-ink mb-5">Edit profile</h2>
          <VendorDashboardForm
            vendorId={vendor.id}
            initial={{
              businessName: vendor.businessName,
              description:  vendor.description ?? "",
              phone:        vendor.phone ?? "",
              email:        vendor.email ?? "",
              city:         vendor.city ?? "",
              priceRange:   vendor.priceRange ?? "",
              logo:         vendor.logo ?? null,
              portfolio,
            }}
          />
        </div>

        {/* Footer */}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-4 border-t border-line text-[12.5px] tp-fade-up-3">
          <Link href="/vendors" className="inline-flex items-center gap-1 text-ink-2 hover:text-ink font-medium transition-colors">
            Browse vendors <ExternalLink size={12} />
          </Link>
          <Link href="/account" className="inline-flex items-center gap-1 text-ink-2 hover:text-ink font-medium transition-colors">
            Account settings
          </Link>
          <Link href="/help/vendors" className="inline-flex items-center gap-1 text-ink-2 hover:text-ink font-medium transition-colors">
            Vendor guide
          </Link>
        </div>
      </div>
    </div>
  )
}
