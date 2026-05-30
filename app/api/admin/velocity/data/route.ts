import { NextResponse } from "next/server"
import { desc, eq, and, like, or, sql } from "drizzle-orm"

import { auth } from "@/auth"
import { db } from "@/db"
import { orders, events } from "@/db/schema"
import type { VelocityOrderMetadata } from "@/types/velocity"

export type VelocityApiOrder = {
  id: string
  status: string | null
  totalAmount: string | null
  currency: string | null
  paymentMethod: string | null
  paymentRef: string | null
  metadata: unknown
  guestEmail: string | null
  guestName: string | null
  guestPhone: string | null
  paidAt: string | null
  createdAt: string | null
  verificationSentAt: string | null
  eventTitle: string | null
  eventSlug: string | null
}

export type VelocityApiResponse = {
  orders: VelocityApiOrder[]
  stats: {
    totalRevenue: number
    totalTransactions: number
    completed: number
    pending: number
    failed: number
    pollSuccess: number
    pollFailed: number
    pollPending: number
    undeliveredRevenue: number
    pendingSettlement: number
  }
}

export async function GET(request: Request) {
  const session = await auth()
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const query = searchParams.get("q")?.trim() ?? ""
  const statusFilter = searchParams.get("status") ?? "all"

  // ── Base condition: must have Velocity metadata ──────────────────────────
  const hasVelocity = sql`${orders.metadata}->>'velocity' IS NOT NULL`

  // ── Build WHERE clause ──────────────────────────────────────────────────
  const conditions: ReturnType<typeof and>[] = [hasVelocity]

  if (query) {
    conditions.push(
      or(
        like(orders.guestEmail, `%${query}%`),
        like(orders.guestName, `%${query}%`),
        like(orders.id, `%${query}%`),
      ),
    )
  }

  if (statusFilter === "pending") {
    conditions.push(
      or(eq(orders.status, "pending"), eq(orders.status, "awaiting_verification")),
    )
  } else if (statusFilter === "failed") {
    conditions.push(
      or(eq(orders.status, "expired"), eq(orders.status, "cancelled")),
    )
  } else if (statusFilter !== "all") {
    conditions.push(eq(orders.status, statusFilter as "paid" | "pending" | "awaiting_verification" | "expired"))
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

  // ── Serialize dates to ISO strings ─────────────────────────────────────
  const serializedOrders: VelocityApiOrder[] = orderRows.map((o) => ({
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
  const velocityPending = allVelocityOrders.filter(
    (o) => o.status === "pending" || o.status === "awaiting_verification",
  )
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

  // Orders where poll workflow finalized but ticket delivery is still pending
  const undeliveredRevenue = allVelocityOrders.filter((o) => {
    const meta = (o.metadata ?? {}) as { velocity?: VelocityOrderMetadata }
    return meta.velocity?.pollStatus === "SUCCESS" && o.status === "awaiting_verification"
  }).reduce((s, o) => s + Number(o.totalAmount ?? 0), 0)

  // Orders where the gateway confirmed payment (paymentStatus or pollStatus = SUCCESS)
  // but TicketPulse hasn't moved them to paid yet — money collected, tickets not issued.
  const pendingSettlement = allVelocityOrders.filter((o) => {
    if (o.status !== "pending" && o.status !== "awaiting_verification") return false
    const meta = (o.metadata ?? {}) as { velocity?: VelocityOrderMetadata }
    const vel = meta.velocity
    return vel?.paymentStatus === "SUCCESS" || vel?.pollStatus === "SUCCESS"
  }).reduce((s, o) => s + Number(o.totalAmount ?? 0), 0)

  const response: VelocityApiResponse = {
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

  return NextResponse.json(response)
}
