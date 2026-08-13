import { redirect } from "next/navigation"

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
        subtitle="Real-time payment dashboard with live updates."
        width="full"
      />
      <div className="px-5 md:px-8 py-8 md:py-10">
        <PaymentsViewer initialData={initialData} />
      </div>
    </div>
  )
}
