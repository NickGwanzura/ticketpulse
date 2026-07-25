import { NextResponse } from "next/server"
import { sql } from "drizzle-orm"

import { db } from "@/db"
import { verifyCronSecret } from "@/lib/cron-auth"
import { log } from "@/lib/logger"
import { sendEmail, adminEmail } from "@/lib/email"
import { sendAdminAlert } from "@/lib/whatsapp"
import { getVelocityReconciliationReport } from "@/lib/velocity-reconciliation"

/**
 * Daily digest of exactly the kind of anomaly that had to be found and fixed
 * by hand this session (Olive Hour): paid/completed orders with no ticket
 * ever issued, outstanding fee-dues on direct sales, and outstanding payout
 * clawbacks. The reconciliation page already detects all of this — the gap
 * was that nobody sees it unless they think to open that page. This makes
 * it come to them instead.
 *
 * Gated to run once per day (08:00 UTC) — called every minute from cron/tick
 * like the whatsapp-watchdog job, so this fires at most once daily.
 */
export async function POST(request: Request) {
  const authError = verifyCronSecret(request)
  if (authError) return authError

  const hourUTC = new Date().getUTCHours()
  if (hourUTC !== 8) {
    return NextResponse.json({ skipped: true, reason: "not the digest hour" })
  }

  try {
    const [zeroTicketRows, feeDueRows, clawbackRows, velocityReport] = await Promise.all([
      db.execute(sql`
        SELECT o.id, o.event_id, e.title AS event_title, o.guest_name, o.total_amount, o.payment_method
        FROM orders o
        INNER JOIN events e ON e.id = o.event_id
        WHERE o.status IN ('paid', 'completed')
          AND NOT EXISTS (
            SELECT 1 FROM tickets t WHERE t.order_id = o.id AND t.status IN ('sold', 'used')
          )
        ORDER BY o.created_at DESC
        LIMIT 20
      `),
      db.execute(sql`
        SELECT COUNT(*)::int AS count, COALESCE(SUM(fee_amount::numeric), 0)::numeric AS total
        FROM organizer_fee_dues
        WHERE status = 'outstanding'
      `),
      db.execute(sql`
        SELECT COUNT(*)::int AS count, COALESCE(SUM(amount::numeric), 0)::numeric AS total
        FROM payout_clawbacks
        WHERE status = 'outstanding'
      `),
      getVelocityReconciliationReport().catch((err) => {
        log.warn("reconciliation-digest - velocity report failed", { error: String(err) })
        return null
      }),
    ])

    const zeroTicketOrders = zeroTicketRows.rows as Record<string, unknown>[]
    const feeDue = (feeDueRows.rows[0] as Record<string, unknown>) ?? { count: 0, total: 0 }
    const clawback = (clawbackRows.rows[0] as Record<string, unknown>) ?? { count: 0, total: 0 }
    const velocityMismatchCount = (velocityReport?.totals.criticalIssues ?? 0) + (velocityReport?.totals.warningIssues ?? 0)

    const totalAnomalies = zeroTicketOrders.length + Number(feeDue.count ?? 0) + Number(clawback.count ?? 0) + velocityMismatchCount

    if (totalAnomalies === 0) {
      log.info("reconciliation-digest - clean, nothing to report")
      return NextResponse.json({ ok: true, anomalies: 0 })
    }

    const summaryLines = [
      zeroTicketOrders.length > 0 ? `${zeroTicketOrders.length} paid order(s) with no ticket ever issued` : null,
      Number(feeDue.count ?? 0) > 0 ? `${feeDue.count} outstanding fee-due(s) on direct sales ($${Number(feeDue.total).toFixed(2)})` : null,
      Number(clawback.count ?? 0) > 0 ? `${clawback.count} outstanding payout clawback(s) ($${Number(clawback.total).toFixed(2)})` : null,
      velocityMismatchCount > 0 ? `${velocityMismatchCount} Velocity/ledger mismatch(es)` : null,
    ].filter(Boolean)

    const whatsappText = [
      `*Reconciliation digest*`,
      ``,
      ...summaryLines.map((l) => `• ${l}`),
      ``,
      `Review: /admin/reconciliation`,
    ].join("\n")

    await sendAdminAlert(whatsappText).catch((err) =>
      log.warn("reconciliation-digest - whatsapp send failed", { error: String(err) }),
    )

    await sendEmail({
      to: adminEmail,
      subject: `Reconciliation digest — ${totalAnomalies} item(s) need review`,
      html: `
        <div style="font-family:sans-serif;max-width:600px">
          <h2>Reconciliation digest</h2>
          <ul>${summaryLines.map((l) => `<li>${l}</li>`).join("")}</ul>
          ${zeroTicketOrders.length > 0 ? `
            <h3>Paid orders with no ticket issued</h3>
            <table style="border-collapse:collapse;width:100%">
              <tr><th align="left">Order</th><th align="left">Event</th><th align="left">Buyer</th><th align="right">Amount</th></tr>
              ${zeroTicketOrders.map((o) => `<tr><td>${String(o.id).slice(0, 8)}</td><td>${o.event_title}</td><td>${o.guest_name ?? "—"}</td><td align="right">$${o.total_amount}</td></tr>`).join("")}
            </table>
          ` : ""}
        </div>
      `,
      text: [`Reconciliation digest — ${totalAnomalies} item(s) need review`, ...summaryLines].join("\n"),
    }).catch((err) => log.warn("reconciliation-digest - email send failed", { error: String(err) }))

    log.info("reconciliation-digest sent", { totalAnomalies, summaryLines })
    return NextResponse.json({ ok: true, anomalies: totalAnomalies, summaryLines })
  } catch (err) {
    log.error("reconciliation-digest failed", { error: String(err) })
    return NextResponse.json({ ok: false, error: "digest failed" }, { status: 500 })
  }
}
