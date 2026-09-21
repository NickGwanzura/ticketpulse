import { redirect } from "next/navigation"
import { desc, eq, and, like, or, sql } from "drizzle-orm"
import Link from "next/link"
import { ReceiptText } from "lucide-react"

import { auth } from "@/auth"
import { db } from "@/db"
import { orders, events } from "@/db/schema"
import type { VelocityOrderMetadata } from "@/types/velocity"
import type { VelocityApiResponse } from "@/app/api/admin/velocity/data/route"

import PageHeader from "@/components/dashboard/PageHeader"
import VelocityViewer from "@/app/admin/_components/VelocityViewer"

export default async function AdminVelocityPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>
}) {
  const session = await auth()
  if (!session?.user || session.user.role !== "admin") {
    redirect("/auth/signin?callbackUrl=/admin/velocity")
  }

  const sp = await searchParams
  const query = sp.q?.trim() ?? ""
  const statusFilter = sp.status ?? "all"

  // ── Base condition: must have Velocity metadata ──────────────────────────
  const hasVelocity = sql`${orders.metadata}->>'velocity' IS NOT NULL`

  // ── Build WHERE clause ──────────────────────────────────────────────────
  const conditions: ReturnType<typeof and>[] = [hasVelocity]

  if (query) {
    conditions.push(
      or(
        like(orders.guestEmail, `%${query}%`),
        like(orders.guestName, `%${query}%`),
        like(sql`${orders.id}::text`, `%${query}%`),
      ),
    )
  }

  if (statusFilter === "pending") {
    conditions.push(eq(orders.status, "pending"))
  } else if (statusFilter === "failed") {
    conditions.push(or(eq(orders.status, "expired"), eq(orders.status, "cancelled")))
  } else if (statusFilter !== "all") {
    conditions.push(eq(orders.status, statusFilter as "paid" | "pending" | "expired"))
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined

  // ── Fetch Velocity orders ──────────────────────────────────────────────
  const orderRows = await db
    .select({
      id: orders.id,
      status: orders.status,
      totalAmount: orders.totalAmount,
      currency: orders.currency,
      paymentMethod: orders.paymentMethod,
      paymentRef: orders.paymentRef,
      metadata: orders.metadata,
      guestEmail: orders.guestEmail,
      guestName: orders.guestName,
      guestPhone: orders.guestPhone,
      paidAt: orders.paidAt,
      createdAt: orders.createdAt,
      verificationSentAt: orders.verificationSentAt,
      eventTitle: events.title,
      eventSlug: events.slug,
    })
    .from(orders)
    .leftJoin(events, eq(orders.eventId, events.id))
    .where(whereClause)
    .orderBy(desc(orders.createdAt))
    .limit(100)

  // ── Serialize dates to ISO strings for client consumption ─────────────
  const serializedOrders = orderRows.map((o) => ({
    ...o,
    paidAt: o.paidAt?.toISOString() ?? null,
    createdAt: o.createdAt?.toISOString() ?? null,
    verificationSentAt: o.verificationSentAt?.toISOString() ?? null,
  }))

  // ── Aggregate stats ────────────────────────────────────────────────────
  const allVelocityOrders = await db
    .select({
      status: orders.status,
      totalAmount: orders.totalAmount,
      metadata: orders.metadata,
    })
    .from(orders)
    .where(hasVelocity)

  const velocityPaid = allVelocityOrders.filter((o) => o.status === "paid")
  const velocityPending = allVelocityOrders.filter((o) => o.status === "pending")
  const velocityFailed = allVelocityOrders.filter(
    (o) => o.status === "expired" || o.status === "cancelled",
  )

  let pollSuccess = 0
  let pollFailed = 0
  let pollPending = 0
  for (const o of allVelocityOrders) {
    const meta = (o.metadata ?? {}) as { velocity?: VelocityOrderMetadata }
    const poll = meta.velocity?.pollStatus
    if (poll === "SUCCESS") pollSuccess++
    else if (poll === "FAILED") pollFailed++
    else pollPending++
  }

  const totalRevenue = velocityPaid.reduce((s, o) => s + Number(o.totalAmount ?? 0), 0)

  const undeliveredRevenue = 0 // no longer applicable since awaiting_verification is removed

  const pendingSettlement = allVelocityOrders
    .filter((o) => {
      if (o.status !== "pending") return false
      const meta = (o.metadata ?? {}) as { velocity?: VelocityOrderMetadata }
      const vel = meta.velocity
      return vel?.paymentStatus === "SUCCESS" || vel?.pollStatus === "SUCCESS"
    })
    .reduce((s, o) => s + Number(o.totalAmount ?? 0), 0)

  const initialData: VelocityApiResponse = {
    orders: serializedOrders,
    stats: {
      totalRevenue,
      totalTransactions: allVelocityOrders.length,
      completed: velocityPaid.length,
      pending: velocityPending.length,
      failed: velocityFailed.length,
      pollSuccess,
      pollFailed,
      pollPending,
      undeliveredRevenue,
      pendingSettlement,
    },
  }

  return (
    <div className="tp-fade-up">
      <PageHeader
        eyebrow="Velocity"
        title="Transaction viewer"
        subtitle="Monitor, recheck, and manage all Velocity Africa payment transactions."
        width="full"
        actions={
          <Link
            href="/admin/reconciliation#velocity-deposits"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-navy px-4 py-2.5 text-[13px] font-semibold text-white transition hover:bg-navy-700"
          >
            <ReceiptText size={14} /> Record Velocity deposit
          </Link>
        }
      />

      <div className="px-5 md:px-8 py-8 md:py-10 space-y-6">
        <VelocityViewer initialData={initialData} />
      </div>
    </div>
  )
}
