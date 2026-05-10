import { redirect } from "next/navigation"
import Link from "next/link"
import { eq } from "drizzle-orm"
import { ArrowUpRight, BadgeCheck, Store } from "lucide-react"

import { auth } from "@/auth"
import { db } from "@/db"
import { vendors } from "@/db/schema"
import { vendorCategoryLabel } from "@/lib/utils"
import { VENDOR_VISUAL } from "@/lib/vendors"
import VendorDashboardForm from "./VendorDashboardForm"

export const dynamic = "force-dynamic"

export default async function VendorDashboardPage() {
  const session = await auth()
  if (!session?.user?.id) {
    redirect("/auth/signin?callbackUrl=/vendors/dashboard")
  }

  const [vendor] = await db
    .select()
    .from(vendors)
    .where(eq(vendors.userId, session.user.id))
    .limit(1)

  if (!vendor) {
    redirect("/vendors/apply")
  }

  const visual = VENDOR_VISUAL[vendor.category] ?? VENDOR_VISUAL.other
  const Icon = visual.icon
  const portfolio = (vendor.portfolio ?? []) as string[]

  return (
    <div>
      <div className="border-b border-line bg-paper-2">
        <div className="max-w-5xl mx-auto px-5 md:px-8 py-10 md:py-14">
          <div className="flex items-start gap-4">
            <span className={`shrink-0 inline-flex w-12 h-12 items-center justify-center rounded-2xl bg-paper ring-1 ${visual.ring}`}>
              <Icon size={20} className={visual.accent} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold tracking-[0.18em] text-blue uppercase mb-2">
                Vendor dashboard
              </p>
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-[28px] md:text-[36px] font-bold tracking-tight leading-[1.1] text-ink">
                  {vendor.businessName}
                </h1>
                {vendor.verified && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-blue-soft text-blue text-[11px] font-semibold px-2 py-0.5 tracking-tight">
                    <BadgeCheck size={12} strokeWidth={2.5} /> Verified
                  </span>
                )}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-paper px-2.5 py-1 text-[11.5px] font-medium text-ink-2">
                  <Store size={11} className="text-ink-3" />
                  {vendorCategoryLabel(vendor.category)}
                </span>
                {vendor.city && (
                  <span className="text-[12.5px] text-ink-3">{vendor.city}</span>
                )}
              </div>
              <p className="mt-2 text-[13.5px] text-ink-2">
                Keep your profile sharp. Organizers shortlist on a glance.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-5 md:px-8 py-10 md:py-12">
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

        <div className="mt-10">
          <Link
            href="/account"
            className="inline-flex items-center gap-1 text-sm font-semibold text-navy hover:gap-1.5 transition-all"
          >
            Back to account <ArrowUpRight size={13} />
          </Link>
        </div>
      </div>
    </div>
  )
}
