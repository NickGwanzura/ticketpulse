import { redirect } from "next/navigation"
import Link from "next/link"

import { auth } from "@/auth"
import PageHeader from "@/components/dashboard/PageHeader"
import PaymentsViewer from "@/app/admin/_components/PaymentsViewer"
import { getAdminPaymentsData } from "@/lib/admin-payments"

export default async function AdminPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  const session = await auth()
  if (!session?.user || session.user.role !== "admin") {
    redirect("/auth/signin?callbackUrl=/admin/payments")
  }

  const sp = await searchParams
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1)
  const initialData = await getAdminPaymentsData(page)

  return (
    <div className="tp-fade-up">
      <PageHeader
        eyebrow="Payments"
        title="Payments"
        subtitle="Live payment operations. Value cards show settled USD order value; Analytics shows platform ticket revenue."
        width="full"
      />
      <div className="px-5 md:px-8 py-8 md:py-10">
        <nav aria-label="Payment tools" className="mb-6 flex flex-wrap gap-2">
          <Link href="/admin/velocity" className="rounded-lg border border-line bg-paper px-3 py-2 text-[12px] font-semibold text-ink hover:border-line-2">Velocity transactions</Link>
          <Link href="/admin/reconciliation" className="rounded-lg border border-line bg-paper px-3 py-2 text-[12px] font-semibold text-ink hover:border-line-2">Reconciliation</Link>
          <Link href="/admin/needs-attention" className="rounded-lg border border-line bg-paper px-3 py-2 text-[12px] font-semibold text-ink hover:border-line-2">Payment exceptions</Link>
        </nav>
        <PaymentsViewer initialData={initialData} />
      </div>
    </div>
  )
}
