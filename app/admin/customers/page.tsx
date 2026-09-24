import { redirect } from "next/navigation"
import { Users } from "lucide-react"

import { auth } from "@/auth"
import PageHeader from "@/components/dashboard/PageHeader"
import EmptyState from "@/components/dashboard/EmptyState"
import { getCustomers, type CustomerRow } from "@/lib/customers"
import CustomersTable from "./CustomersTable"
import { formatCurrency } from "@/lib/utils"

export default async function AdminCustomersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const session = await auth()
  if (!session?.user || session.user.role !== "admin") redirect("/auth/signin?callbackUrl=/admin/customers")

  const params = await searchParams
  const search = (params.q ?? "").trim()

  let customers: CustomerRow[] = []
  try {
    customers = await getCustomers({ search: search || undefined })
  } catch (err) {
    console.error("[admin/customers] Failed to load customers:", err)
  }

  const repeatBuyers = customers.filter((c) => c.orderCount > 1).length

  return (
    <div className="tp-fade-up">
      <PageHeader
        eyebrow="CRM"
        title="Customers"
        subtitle="Every buyer across every event, aggregated by email — repeat purchases, lifetime spend, and which events they've attended."
        width="full"
      />

      <div className="px-5 md:px-8 py-8 md:py-10 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
          <div className="rounded-2xl border border-line bg-paper p-5">
            <p className="text-[12px] text-ink-3 mb-0.5">Unique buyers</p>
            <p className="text-[28px] font-bold tracking-tight text-ink leading-none tabular-nums">{customers.length}</p>
          </div>
          <div className="rounded-2xl border border-line bg-paper p-5">
            <p className="text-[12px] text-ink-3 mb-0.5">Repeat buyers</p>
            <p className="text-[28px] font-bold tracking-tight text-ink leading-none tabular-nums">{repeatBuyers}</p>
          </div>
          <div className="rounded-2xl border border-line bg-paper p-5">
            <p className="text-[12px] text-ink-3 mb-0.5">Total lifetime revenue</p>
            <p className="text-[28px] font-bold tracking-tight text-ink leading-none tabular-nums">
              {formatCurrency(customers.reduce((sum, c) => sum + c.totalSpent, 0), "USD")}
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
