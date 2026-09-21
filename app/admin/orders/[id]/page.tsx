import { redirect, notFound } from "next/navigation"
import Link from "next/link"
import { desc, eq } from "drizzle-orm"
import { ArrowLeft, CreditCard, Ticket, Calendar,
  Clock, User, MapPin, Smartphone, ExternalLink,
  Send, CheckCircle2, RefreshCw, FileDown,
  AlertTriangle,
} from "lucide-react"

import { auth } from "@/auth"
import { db } from "@/db"
import { orders, events, paymentLedger, tickets, ticketTiers, users } from "@/db/schema"
import PageHeader from "@/components/dashboard/PageHeader"
import { formatCurrency, formatDateShort } from "@/lib/utils"
import { auditOrderPaymentLedger } from "@/lib/payment-ledger-audit"
import RecoveryPanel from "@/components/orders/RecoveryPanel"
import AuditTrail from "@/components/orders/AuditTrail"
import DeleteOrderButton from "@/app/admin/_components/DeleteOrderButton"
import {
  recheckPaymentAction,
} from "@/app/admin/actions/velocity"
import {
  sendTicketsAction,
  completeAndSendAction,
  resendOrderEmailAction,
  regeneratePdfAction,
  sendWhatsAppTicketAction,
} from "@/app/admin/actions/orders"

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await auth()
  if (!session?.user || session.user.role !== "admin") {
    redirect("/auth/signin?callbackUrl=/admin/orders")
  }

  const { id } = await params

  const [order] = await db
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
      createdAt: orders.createdAt,
      paidAt: orders.paidAt,
      verifiedAt: orders.verifiedAt,
      completedAt: orders.completedAt,
      verificationSentAt: orders.verificationSentAt,
      eventId: orders.eventId,
      userId: orders.userId,
    })
    .from(orders)
    .where(eq(orders.id, id))
    .limit(1)

  if (!order) notFound()

  const [event] = order.eventId
    ? await db
        .select({ id: events.id, title: events.title, slug: events.slug, startsAt: events.startsAt, venue: events.venue })
        .from(events)
        .where(eq(events.id, order.eventId))
        .limit(1)
    : [null]

  const [buyer] = order.userId
    ? await db
        .select({ name: users.name, email: users.email })
        .from(users)
        .where(eq(users.id, order.userId))
        .limit(1)
    : [null]

  const orderTickets = await db
    .select({
      id: tickets.id,
      status: tickets.status,
      qrCode: tickets.qrCode,
      scannedAt: tickets.scannedAt,
      tierName: ticketTiers.name,
    })
    .from(tickets)
    .leftJoin(ticketTiers, eq(ticketTiers.id, tickets.tierId))
    .where(eq(tickets.orderId, id))

  const ledgerEntries = await db
    .select({
      id: paymentLedger.id,
      transactionTrace: paymentLedger.transactionTrace,
      salesOrderTrace: paymentLedger.salesOrderTrace,
      invoiceId: paymentLedger.invoiceId,
      amount: paymentLedger.amount,
      currency: paymentLedger.currency,
      processor: paymentLedger.processor,
      velocityPollStatus: paymentLedger.velocityPollStatus,
      localStatus: paymentLedger.localStatus,
      source: paymentLedger.source,
      errorMessage: paymentLedger.errorMessage,
      createdAt: paymentLedger.createdAt,
    })
    .from(paymentLedger)
    .where(eq(paymentLedger.orderId, id))
    .orderBy(desc(paymentLedger.createdAt))

  const customerName = order.guestName ?? buyer?.name ?? "Guest"
  const customerEmail = order.guestEmail ?? buyer?.email ?? "—"
  const paymentAuditIssues = auditOrderPaymentLedger(order, ledgerEntries)

  const isUnsettled = order.status !== "paid" && order.status !== "completed"
  const latestLedgerEntry = ledgerEntries[0] ?? null
  const incompleteReason = isUnsettled
    ? latestLedgerEntry?.errorMessage
      ?? (latestLedgerEntry?.localStatus === "pending"
        ? "Payment is still pending confirmation from the gateway."
        : latestLedgerEntry
        ? `Last ledger entry is "${latestLedgerEntry.localStatus}" with no error message recorded.`
        : "No payment ledger entry exists for this order — the customer likely never reached the gateway.")
    : null

  // ── Bound server actions for the client component ───────────────────────
  const recheckPayment = async () => {
    "use server"
    await recheckPaymentAction(id)
  }

  const sendTickets = async () => {
    "use server"
    await sendTicketsAction(id)
  }

  const completeAndSend = async () => {
    "use server"
    await completeAndSendAction(id)
  }

  const resendVerification = async () => {
    "use server"
    await resendOrderEmailAction(id)
  }

  const regeneratePdf = async () => {
    "use server"
    await regeneratePdfAction(id)
  }

  const sendWhatsAppTicket = async () => {
    "use server"
    await sendWhatsAppTicketAction(id)
  }

  return (
    <div className="tp-fade-up">
      <PageHeader
        eyebrow="Order"
        title={`Order ${id.slice(0, 8)}`}
        subtitle={`Placed ${order.createdAt ? formatDateShort(order.createdAt) : "—"}`}
        width="xl"
        actions={
          <Link
            href="/admin/orders"
            className="inline-flex items-center gap-2 rounded-xl border border-line bg-paper px-4 py-2.5 text-sm font-medium text-ink hover:border-line-2 transition-colors"
          >
            <ArrowLeft size={14} /> Back to orders
          </Link>
        }
      />

      <div className="max-w-5xl mx-auto px-5 md:px-8 py-10 space-y-8">
        {/* Recovery Panel */}
        <RecoveryPanel
          order={{
            id: order.id,
            status: order.status ?? "pending",
            paymentMethod: order.paymentMethod,
            metadata: order.metadata,
            createdAt: order.createdAt,
            paidAt: order.paidAt,
            verificationSentAt: order.verificationSentAt,
            verifiedAt: order.verifiedAt,
            completedAt: order.completedAt,
          }}
          actions={{
            recheckPayment,
            resendVerification,
            completeAndSend,
            sendTickets,
          }}
        />

        {incompleteReason && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-5 ring-1 ring-amber-100">
            <div className="flex items-start gap-3">
              <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-700" />
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-semibold text-amber-900">Why this payment never completed</p>
                <p className="mt-1 text-[13px] text-amber-800">{incompleteReason}</p>
                {latestLedgerEntry && (
                  <p className="mt-2 text-[12px] text-amber-700">
                    Last attempt: {latestLedgerEntry.createdAt ? formatDateShort(latestLedgerEntry.createdAt) : "—"} via {latestLedgerEntry.processor}
                    {latestLedgerEntry.velocityPollStatus ? ` (Velocity poll: ${latestLedgerEntry.velocityPollStatus})` : ""}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {paymentAuditIssues.length > 0 && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50/70 p-5 ring-1 ring-rose-100">
            <div className="flex items-start gap-3">
              <AlertTriangle size={18} className="mt-0.5 shrink-0 text-rose-700" />
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-semibold text-rose-900">Payment ledger warning</p>
                <p className="mt-1 text-[13px] text-rose-800">
                  This order needs review before revenue is trusted or manual ticket actions are repeated.
                </p>
                <ul className="mt-3 space-y-2">
                  {paymentAuditIssues.map((issue) => (
                    <li key={issue.code} className="rounded-xl border border-rose-200 bg-paper/60 px-3.5 py-2.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[13px] font-semibold text-rose-950">{issue.title}</span>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                          issue.severity === "critical"
                            ? "bg-rose-100 text-rose-800"
                            : "bg-amber-100 text-amber-800"
                        }`}>
                          {issue.severity}
                        </span>
                      </div>
                      <p className="mt-1 text-[12px] text-rose-800">{issue.detail}</p>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Order summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-2xl border border-line bg-paper p-5">
            <div className="flex items-center gap-2 mb-3">
              <User size={14} className="text-ink-3" />
              <span className="text-[13px] text-ink-3">Customer</span>
            </div>
            <p className="text-[16px] font-semibold text-ink">{customerName}</p>
            <p className="text-[13px] text-ink-3 mt-0.5">{customerEmail}</p>
            {order.guestPhone && (
              <p className="text-[13px] text-ink-3 mt-0.5 flex items-center gap-1">
                <Smartphone size={12} /> {order.guestPhone}
              </p>
            )}
          </div>

          <div className="rounded-2xl border border-line bg-paper p-5">
            <div className="flex items-center gap-2 mb-3">
              <Calendar size={14} className="text-ink-3" />
              <span className="text-[13px] text-ink-3">Event</span>
            </div>
            <p className="text-[16px] font-semibold text-ink">{event?.title ?? "—"}</p>
            {event && (
              <>
                <p className="text-[13px] text-ink-3 mt-0.5 flex items-center gap-1">
                  <Clock size={12} /> {event.startsAt ? formatDateShort(event.startsAt) : "—"}
                </p>
                <p className="text-[13px] text-ink-3 mt-0.5 flex items-center gap-1">
                  <MapPin size={12} /> {event.venue ?? "—"}
                </p>
              </>
            )}
          </div>

          <div className="rounded-2xl border border-line bg-paper p-5">
            <div className="flex items-center gap-2 mb-3">
              <CreditCard size={14} className="text-ink-3" />
              <span className="text-[13px] text-ink-3">Payment</span>
            </div>
            <p className="text-[16px] font-semibold text-ink">
              {formatCurrency(Number(order.totalAmount ?? 0), order.currency ?? "USD")}
            </p>
            <p className="text-[13px] text-ink-3 mt-0.5">{order.paymentMethod ?? "—"}</p>
            {order.paymentRef && (
              <p className="text-[13px] text-ink-3 mt-0.5 font-mono">{order.paymentRef}</p>
            )}
          </div>
        </div>

        {/* Recovery Actions */}
        {order.status !== "paid" && order.status !== "completed" && order.status !== "cancelled" && order.status !== "refunded" && (
          <div className="rounded-2xl border border-line bg-paper overflow-hidden">
            <div className="px-5 md:px-6 py-4 border-b border-line">
              <h3 className="text-[15px] font-semibold tracking-tight text-ink flex items-center gap-2">
                <RefreshCw size={15} className="text-ink-3" /> Recovery Actions
              </h3>
            </div>
            <div className="p-5 md:p-6 flex flex-wrap gap-3">
              <form action={recheckPayment}>
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 rounded-xl bg-amber-600 px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-amber-700 transition-colors"
                >
                  <RefreshCw size={14} /> Recheck payment
                </button>
              </form>
              <form action={completeAndSend}>
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-emerald-700 transition-colors"
                >
                  <CheckCircle2 size={14} /> Complete & send
                </button>
              </form>
              <form action={sendTickets}>
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 rounded-xl bg-navy px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-navy/90 transition-colors"
                >
                  <Send size={14} /> Resend tickets
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Paid/Completed actions */}
        {(order.status === "paid" || order.status === "completed") && (
          <div className="rounded-2xl border border-line bg-paper overflow-hidden">
            <div className="px-5 md:px-6 py-4 border-b border-line">
              <h3 className="text-[15px] font-semibold tracking-tight text-ink flex items-center gap-2">
                <Send size={15} className="text-ink-3" /> Delivery Actions
              </h3>
            </div>
            <div className="p-5 md:p-6 flex flex-wrap gap-3">
              <form action={sendTickets}>
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 rounded-xl bg-navy px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-navy/90 transition-colors"
                >
                  <Send size={14} /> Resend tickets
                </button>
              </form>
              <form action={regeneratePdf}>
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-violet-700 transition-colors"
                >
                  <FileDown size={14} /> Regenerate A6 PDF
                </button>
              </form>
              {order.guestPhone && (
                <form action={sendWhatsAppTicket}>
                  <button
                    type="submit"
                    className="inline-flex items-center gap-2 rounded-xl border border-[#25D366] bg-[#25D366]/5 px-4 py-2.5 text-[13px] font-semibold text-[#128C4A] hover:bg-[#25D366]/10 transition-colors"
                  >
                    <Smartphone size={14} /> Send PDF to WhatsApp
                  </button>
                </form>
              )}
            </div>
          </div>
        )}

        {/* PDF Version Badge */}
        {(() => {
          const meta = (order.metadata ?? {}) as Record<string, unknown>
          const delivery = meta.delivery as Record<string, unknown> | undefined
          const pdfVersion = delivery?.pdfVersion as string | undefined
          return (
            <div className="rounded-2xl border border-line bg-paper p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileDown size={14} className="text-ink-3" />
                  <span className="text-[13px] text-ink-3">PDF Version</span>
                </div>
                <span
                  className={`inline-block text-[11px] font-semibold px-2.5 py-1 rounded-full ${
                    pdfVersion === "A6_V1"
                      ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                      : pdfVersion
                      ? "bg-amber-50 text-amber-700 ring-1 ring-amber-200"
                      : "bg-gray-50 text-gray-500 ring-1 ring-gray-200"
                  }`}
                >
                  {pdfVersion ?? "Not generated"}
                </span>
              </div>
              {pdfVersion && pdfVersion !== "A6_V1" && (
                <p className="text-[12px] text-amber-600 mt-2">
                  This order uses an older PDF format. Click &ldquo;Regenerate A6 PDF&rdquo; above to upgrade.
                </p>
              )}
              {!pdfVersion && orderTickets.length > 0 && (
                <p className="text-[12px] text-amber-600 mt-2">
                  PDF version not tracked. Click &ldquo;Regenerate A6 PDF&rdquo; above to generate with the latest A6 template.
                </p>
              )}
            </div>
          )
        })()}

        {/* Payment Ledger */}
        <div className="rounded-2xl border border-line bg-paper overflow-hidden">
          <div className="px-5 md:px-6 py-4 border-b border-line flex items-center justify-between">
            <h3 className="text-[15px] font-semibold tracking-tight text-ink flex items-center gap-2">
              <CreditCard size={15} className="text-ink-3" /> Payment ledger
            </h3>
            <span className="text-[12px] text-ink-3">{ledgerEntries.length} row{ledgerEntries.length === 1 ? "" : "s"}</span>
          </div>
          {ledgerEntries.length === 0 ? (
            <p className="px-5 md:px-6 py-5 text-[13px] text-ink-3">No ledger rows recorded for this order.</p>
          ) : (
            <div className="divide-y divide-line">
              {ledgerEntries.map((entry) => (
                <div key={entry.id} className="px-5 md:px-6 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${
                        entry.localStatus === "paid"
                          ? "bg-emerald-50 text-emerald-700"
                          : entry.localStatus === "failed"
                          ? "bg-rose-50 text-rose-700"
                          : "bg-amber-50 text-amber-700"
                      }`}>
                        {entry.localStatus}
                      </span>
                      <span className="text-[12px] text-ink-3 capitalize">{entry.processor}</span>
                      <span className="text-[12px] text-ink-3">via {entry.source}</span>
                      {entry.velocityPollStatus && (
                        <span className="text-[12px] text-ink-3">Velocity {entry.velocityPollStatus}</span>
                      )}
                    </div>
                    <span className="text-[13px] font-bold text-ink tabular-nums">
                      {formatCurrency(Number(entry.amount ?? 0), entry.currency ?? "USD")}
                    </span>
                  </div>
                  <div className="mt-2 grid gap-1 text-[11px] text-ink-3 md:grid-cols-2">
                    <p className="truncate font-mono">tx: {entry.transactionTrace || "—"}</p>
                    <p className="truncate font-mono">sales: {entry.salesOrderTrace || "—"}</p>
                    <p className="truncate font-mono">invoice: {entry.invoiceId || "—"}</p>
                    <p>{entry.createdAt ? formatDateShort(entry.createdAt) : "—"}</p>
                  </div>
                  {entry.errorMessage && (
                    <p className="mt-2 rounded-lg bg-rose-50 px-2.5 py-1.5 text-[12px] text-rose-800">
                      {entry.errorMessage}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Tickets */}
        {orderTickets.length > 0 && (
          <div className="rounded-2xl border border-line bg-paper overflow-hidden">
            <div className="px-5 md:px-6 py-4 border-b border-line flex items-center justify-between">
              <h3 className="text-[15px] font-semibold tracking-tight text-ink flex items-center gap-2">
                <Ticket size={15} className="text-ink-3" /> Tickets
              </h3>
              <span className="text-[12px] text-ink-3">{orderTickets.length} issued</span>
            </div>
            <div className="divide-y divide-line">
              {orderTickets.map((t) => (
                <div key={t.id} className="px-5 md:px-6 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-[14px] font-medium text-ink">{t.tierName ?? "Ticket"}</p>
                    <p className="text-[11px] font-mono text-ink-3 mt-0.5">{t.id.slice(0, 16)}</p>
                  </div>
                  <div className="text-right">
                    <span
                      className={`text-[11px] font-semibold tracking-wide uppercase px-2 py-1 rounded-full ${
                        t.status === "used"
                          ? "bg-emerald-50 text-emerald-700"
                          : t.status === "cancelled"
                          ? "bg-rose-50 text-rose-700"
                          : "bg-amber-50 text-amber-700"
                      }`}
                    >
                      {t.status}
                    </span>
                    {t.scannedAt && (
                      <p className="text-[11px] text-ink-3 mt-1">
                        Scanned {formatDateShort(t.scannedAt)}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Audit Trail */}
        <AuditTrail
          order={{
            status: order.status ?? "pending",
            createdAt: order.createdAt,
            paidAt: order.paidAt,
            verifiedAt: order.verifiedAt,
            completedAt: order.completedAt,
            verificationSentAt: order.verificationSentAt,
            metadata: order.metadata,
          }}
        />

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-3">
          {orderTickets.length > 0 && (
            <Link
              href={`/orders/${id}/print`}
              target="_blank"
              className="inline-flex items-center gap-2 rounded-xl border border-line bg-paper px-4 py-2.5 text-sm font-medium text-ink hover:border-line-2 transition-colors"
            >
              <ExternalLink size={14} /> View tickets
            </Link>
          )}
          <DeleteOrderButton orderId={id} variant="desktop" />
        </div>
      </div>
    </div>
  )
}
