import { redirect } from "next/navigation"
import { desc, eq, and, isNull, isNotNull } from "drizzle-orm"
import { CheckCircle2, XCircle, Store } from "lucide-react"

import { auth } from "@/auth"
import { db } from "@/db"
import { vendors } from "@/db/schema"
import PageHeader from "@/components/dashboard/PageHeader"
import EmptyState from "@/components/dashboard/EmptyState"
import { approveVendorAction, rejectVendorAction } from "./actions"

export const metadata = { title: "Vendor verification" }

export default async function AdminVendorsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const session = await auth()
  if (!session?.user || session.user.role !== "admin") {
    redirect("/auth/signin?callbackUrl=/admin/vendors")
  }

  const sp = await searchParams
  const status = sp.status === "verified" || sp.status === "rejected" ? sp.status : "pending"

  const whereClause =
    status === "verified"
      ? eq(vendors.verified, true)
      : status === "rejected"
        ? and(eq(vendors.verified, false), isNotNull(vendors.rejectedAt))
        : and(eq(vendors.verified, false), isNull(vendors.rejectedAt))

  const rows = await db
    .select({
      id: vendors.id,
      businessName: vendors.businessName,
      category: vendors.category,
      city: vendors.city,
      phone: vendors.phone,
      email: vendors.email,
      description: vendors.description,
      verified: vendors.verified,
      rejectedAt: vendors.rejectedAt,
      createdAt: vendors.createdAt,
    })
    .from(vendors)
    .where(whereClause)
    .orderBy(desc(vendors.createdAt))
    .limit(80)

  return (
    <div className="tp-fade-up">
      <PageHeader
        eyebrow="Admin"
        title="Vendor verification"
        subtitle="Approve vendor applications before they appear in the public marketplace."
        width="full"
      />

      <div className="px-5 md:px-8 py-8 md:py-10 space-y-5">
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
          {(["pending", "verified", "rejected"] as const).map((tab) => (
            <a
              key={tab}
              href={`/admin/vendors?status=${tab}`}
              className={`rounded-lg px-3.5 py-2 text-[13px] capitalize transition-colors ${
                status === tab ? "bg-paper-2 text-ink font-semibold ring-1 ring-line" : "text-ink-2 hover:text-ink hover:bg-paper-2 font-medium"
              }`}
            >
              {tab}
            </a>
          ))}
        </div>

        <div className="rounded-2xl border border-line bg-paper overflow-hidden">
          {rows.length === 0 ? (
            <EmptyState icon={Store} title="No vendors here" body="Vendor applications will appear here for review." />
          ) : (
            <div className="divide-y divide-line">
              {rows.map((vendor) => (
                <article key={vendor.id} className="p-5 md:p-6">
                  <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                    <div className="min-w-0">
                      <h2 className="text-[16px] font-bold tracking-tight text-ink">{vendor.businessName}</h2>
                      <p className="mt-1 text-[13px] text-ink-3 capitalize">
                        {vendor.category.replace("_", " ")} · {vendor.city} · {vendor.phone} · {vendor.email}
                      </p>
                      {vendor.description && (
                        <p className="mt-3 max-w-3xl text-[14px] leading-6 text-ink-2">{vendor.description}</p>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      {!vendor.verified && (
                        <form action={approveVendorAction.bind(null, vendor.id)}>
                          <button className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-2 text-[12px] font-semibold text-white">
                            <CheckCircle2 size={14} /> Approve
                          </button>
                        </form>
                      )}
                      {(vendor.verified || !vendor.rejectedAt) && (
                        <form action={rejectVendorAction.bind(null, vendor.id)}>
                          <button className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] font-semibold text-rose-700">
                            <XCircle size={14} /> {vendor.verified ? "Revoke" : "Reject"}
                          </button>
                        </form>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
