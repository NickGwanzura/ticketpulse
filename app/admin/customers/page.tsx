import { redirect } from "next/navigation"
import { Users } from "lucide-react"

import { auth } from "@/auth"
import PageHeader from "@/components/dashboard/PageHeader"
import EmptyState from "@/components/dashboard/EmptyState"
import { getCustomers, getCustomerSummary, type CustomerRow, type CustomerSummary } from "@/lib/customers"
import CustomersTable from "./CustomersTable"
import { formatCurrency } from "@/lib/utils"
import SectionLinks from "@/app/admin/_components/SectionLinks"

export default async function AdminCustomersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const session = await auth()
  if (!session?.user || session.user.role !== "admin") redirect("/auth/signin?callbackUrl=/admin/customers")

  const params = await searchParams
  const search = (params.q ?? "").trim()

  let customers: CustomerRow[] = []
  let summary: CustomerSummary = { uniqueBuyers: 0, repeatBuyers: 0, totalSpent: 0 }
  try {
    ;[customers, summary] = await Promise.all([
      getCustomers({ search: search || undefined, currency: "USD" }),
      getCustomerSummary(search || undefined),
    ])
  } catch (err) {
    console.error("[admin/customers] Failed to load customers:", err)
  }

  return (
    <div className="tp-fade-up">
      <PageHeader
        eyebrow="CRM"
        title="Customers"
        subtitle="USD paid buyers across events, grouped by email. Totals include all matching buyers; the table shows the top 500."
        width="full"
      />

      <div className="px-5 md:px-8 py-8 md:py-10 space-y-6">
        <SectionLinks label="People tools" links={[{ label: "User accounts", href: "/admin/users" }]} />
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
          <div className="rounded-2xl border border-line bg-paper p-5">
            <p className="text-[12px] text-ink-3 mb-0.5">Unique buyers</p>
            <p className="text-[28px] font-bold tracking-tight text-ink leading-none tabular-nums">{summary.uniqueBuyers}</p>
          </div>
          <div className="rounded-2xl border border-line bg-paper p-5">
            <p className="text-[12px] text-ink-3 mb-0.5">Repeat buyers</p>
            <p className="text-[28px] font-bold tracking-tight text-ink leading-none tabular-nums">{summary.repeatBuyers}</p>
          </div>
          <div className="rounded-2xl border border-line bg-paper p-5">
            <p className="text-[12px] text-ink-3 mb-0.5">USD lifetime order value</p>
            <p className="text-[28px] font-bold tracking-tight text-ink leading-none tabular-nums">
              {formatCurrency(summary.totalSpent, "USD")}
            </p>
          </div>
        </div>

        <form className="max-w-sm">
          <input
            name="q"
            defaultValue={search}
            placeholder="Search name, email, or phone..."
            className="w-full rounded-xl border border-line bg-paper px-3.5 py-2.5 text-[14px] text-ink outline-none focus:border-navy"
          />
        </form>

        {customers.length > 0 ? (
          <CustomersTable rows={customers} />
        ) : (
          <EmptyState
            icon={Users}
            title="No customers yet"
            body="Once orders come in, buyers will be aggregated here by email — repeat purchases, lifetime spend, and events attended."
            variant="inline"
          />
        )}
      </div>
    </div>
  )
}
