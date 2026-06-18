import "server-only"
import { sendEmail, adminEmail } from "@/lib/email"
import { sendAdminAlert } from "@/lib/whatsapp"
import { paymentAnomalyAlert } from "@/lib/whatsapp-templates"
import { log } from "@/lib/logger"
import { getBaseUrl } from "@/lib/url-config"

// ─── Severity Levels ─────────────────────────────────────────────────────────

export type AlertSeverity = "low" | "medium" | "high" | "critical"

export type AlertType =
  // Transaction initiation failures
  | "TRANSACTION_MISSING_TRACE"
  | "TRANSACTION_MISSING_REDIRECT_URL"
  | "TRANSACTION_EMPTY_BODY"
  | "TRANSACTION_API_ERROR"
  // Polling / status failures
  | "POLL_UNKNOWN_STATUS"
  | "POLL_NETWORK_ERROR"
  | "POLL_FINALIZE_NON_PAID"
  | "POLL_API_ERROR"
  // Callback failures
  | "CALLBACK_ORDER_NOT_FOUND"
  | "CALLBACK_FINALIZE_FAILED"
  | "CALLBACK_INVALID_SIGNATURE"
  | "CALLBACK_INVALID_PAYLOAD"
  // Workflow failures
  | "WORKFLOW_FINALIZE_ERROR"
  | "WORKFLOW_RECONCILIATION_LAG"
  // Cron / recheck
  | "RECHECK_PERSISTENT_FAILURE"
  | "RECHECK_HIGH_ERROR_RATE"
  // General Velocity API
  | "VELOCITY_API_UNEXPECTED_FORMAT"
  | "VELOCITY_NETWORK_ERROR"
  | "VELOCITY_CONFIG_MISSING"

// ─── Alert Payload ──────────────────────────────────────────────────────────

export interface AlertPayload {
  /** Machine-readable alert type */
  type: AlertType
  /** Severity level */
  severity: AlertSeverity
  /** Human-readable summary (max 120 chars) */
  title: string
  /** Detailed description */
  detail: string
  /** Related order/transaction IDs for cross-referencing */
  orderId?: string
  transactionTrace?: string
  salesOrderTrace?: string
  /** Payment method context */
  paymentMethod?: string
  /** Raw error data (sanitized — never includes secrets, card numbers, or PII) */
  context?: Record<string, unknown>
}

// ─── Alert Deduplication ─────────────────────────────────────────────────────
// Prevents flooding the same alert within the cooldown window.

const alertCache = new Map<string, number>()
const ALERT_COOLDOWN_MS = 30 * 60 * 1000 // 30 minutes per alert type + order combo

function shouldSend(key: string): boolean {
  const lastSent = alertCache.get(key)
  const now = Date.now()
  if (lastSent && now - lastSent < ALERT_COOLDOWN_MS) {
    return false
  }
  alertCache.set(key, now)
  // Prune stale entries periodically
  if (alertCache.size > 500) {
    const cutoff = now - ALERT_COOLDOWN_MS
    for (const [k, v] of alertCache) {
      if (v < cutoff) alertCache.delete(k)
    }
  }
  return true
}

// ─── Severity Labels ─────────────────────────────────────────────────────────

const SEVERITY_LABELS: Record<AlertSeverity, string> = {
  low: "ℹ️",
  medium: "⚠️",
  high: "🚨",
  critical: "🔥",
}

// ─── Alert Dispatch ──────────────────────────────────────────────────────────

/**
 * Send an alert about a Velocity payment anomaly.
 *
 * Alerts are dispatched through all available channels:
 *   1. Structured log entry (always)
 *   2. Admin email (medium+ severity)
 *   3. Admin WhatsApp (high+ severity)
 *
 * Deduplication: same alert type + orderId within 5 min is suppressed
 * to prevent alert storms.
 */
export async function alertPaymentAnomaly(payload: AlertPayload): Promise<void> {
  const { type, severity, title, detail, orderId, transactionTrace, salesOrderTrace, paymentMethod, context } = payload

  // ── Dedup key ──────────────────────────────────────────────────────────
  const dedupKey = `${type}:${orderId ?? "global"}:${transactionTrace ?? "global"}`
  if (!shouldSend(dedupKey)) {
    log.debug("payment-alert suppressed (cooldown)", { type, orderId, dedupKey })
    return
  }

  const prefix = SEVERITY_LABELS[severity]
  const logMeta: Record<string, unknown> = {
    alertType: type,
    severity,
    orderId,
    transactionTrace,
    salesOrderTrace,
    paymentMethod,
    ...(context ? { context } : {}),
  }

  // ── 1. Always log ─────────────────────────────────────────────────────
  if (severity === "critical" || severity === "high") {
    log.error(`[PAYMENT ALERT] ${prefix} ${title}`, logMeta)
  } else {
    log.warn(`[PAYMENT ALERT] ${prefix} ${title}`, logMeta)
  }

  // ── 2. Admin email (medium+ severity, but not for transient/expected errors) ──
  const skipEmailTypes: AlertType[] = [
    "TRANSACTION_MISSING_REDIRECT_URL", // caught and handled gracefully
    "POLL_NETWORK_ERROR",               // transient, auto-retries
  ]

  if (severity !== "low" && !skipEmailTypes.includes(type)) {
    const emailHtml = buildAlertEmail(payload)
    const emailText = buildAlertText(payload)
    sendEmail({
      to: adminEmail,
      subject: `${prefix} [${type}] ${title}`,
      html: emailHtml,
      text: emailText,
    }).catch((err) => {
      log.warn("payment-alert — admin email failed", { type, error: String(err) })
    })
  }

  // ── 3. WhatsApp alert (high+ severity only) ───────────────────────────
  if (severity === "high" || severity === "critical") {
    sendAdminAlert(
      paymentAnomalyAlert(title, orderId, type, detail),
    ).catch((err) => {
      log.warn("payment-alert — WhatsApp admin alert failed", { type, error: String(err) })
    })
  }
}

// ─── Email Template ──────────────────────────────────────────────────────────

function buildAlertEmail(payload: AlertPayload): string {
  const { type, severity, title, detail, orderId, transactionTrace, salesOrderTrace, paymentMethod, context } = payload

  const contextRows = context
    ? Object.entries(context)
        .filter(([k]) => !k.toLowerCase().includes("secret") && !k.toLowerCase().includes("key"))
        .slice(0, 15)
        .map(([k, v]) => {
          const val = typeof v === "object" ? JSON.stringify(v).slice(0, 500) : String(v ?? "")
          return `<tr><td style="padding:4px 12px 4px 0;font-size:12px;font-weight:600;color:#888;white-space:nowrap;vertical-align:top;">${k}</td><td style="padding:4px 0;font-size:12px;color:#333;word-break:break-all;">${val}</td></tr>`
        })
        .join("")
    : ""

  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:600px;margin:0 auto;">
      <div style="padding:16px 20px;background:${severity === "critical" ? "#dc2626" : severity === "high" ? "#ea580c" : "#2563eb"};border-radius:12px 12px 0 0;">
        <h1 style="font-size:18px;font-weight:700;color:#fff;margin:0;">${title}</h1>
      </div>
      <div style="border:1px solid #e5e7eb;border-top:0;border-radius:0 0 12px 12px;padding:20px;">
        <table style="width:100%;border-collapse:collapse;">
          <tr><td style="padding:4px 12px 4px 0;font-size:12px;font-weight:600;color:#888;white-space:nowrap;">Alert</td><td style="padding:4px 0;font-size:13px;color:#333;">${type}</td></tr>
          <tr><td style="padding:4px 12px 4px 0;font-size:12px;font-weight:600;color:#888;white-space:nowrap;">Severity</td><td style="padding:4px 0;font-size:13px;color:#333;">${severity.toUpperCase()}</td></tr>
          ${orderId ? `<tr><td style="padding:4px 12px 4px 0;font-size:12px;font-weight:600;color:#888;white-space:nowrap;">Order</td><td style="padding:4px 0;font-size:13px;color:#333;font-family:monospace;">${orderId}</td></tr>` : ""}
          ${transactionTrace ? `<tr><td style="padding:4px 12px 4px 0;font-size:12px;font-weight:600;color:#888;white-space:nowrap;">Transaction</td><td style="padding:4px 0;font-size:13px;color:#333;font-family:monospace;">${transactionTrace}</td></tr>` : ""}
          ${salesOrderTrace ? `<tr><td style="padding:4px 12px 4px 0;font-size:12px;font-weight:600;color:#888;white-space:nowrap;">Sales Order</td><td style="padding:4px 0;font-size:13px;color:#333;font-family:monospace;">${salesOrderTrace}</td></tr>` : ""}
          ${paymentMethod ? `<tr><td style="padding:4px 12px 4px 0;font-size:12px;font-weight:600;color:#888;white-space:nowrap;">Method</td><td style="padding:4px 0;font-size:13px;color:#333;">${paymentMethod}</td></tr>` : ""}
        </table>
        <div style="margin-top:12px;padding:12px;background:#f9fafb;border-radius:8px;font-size:13px;color:#333;line-height:1.5;">
          ${detail}
        </div>
        ${contextRows ? `<h3 style="font-size:13px;font-weight:600;color:#555;margin:16px 0 8px;">Context</h3><table style="width:100%;border-collapse:collapse;">${contextRows}</table>` : ""}
        ${orderId ? `<p style="margin-top:16px;"><a href="${getBaseUrl()}/admin/orders/${orderId}" style="display:inline-block;padding:8px 16px;background:#1a1a2e;color:#fff;border-radius:8px;font-size:13px;font-weight:600;text-decoration:none;">View order →</a></p>` : ""}
      </div>
    </div>`
}

function buildAlertText(payload: AlertPayload): string {
  const { type, severity, title, detail, orderId, transactionTrace, salesOrderTrace } = payload
  return [
    `[${severity.toUpperCase()}] ${title}`,
    `Type: ${type}`,
    "",
    detail,
    "",
    orderId ? `Order: ${orderId}` : null,
    transactionTrace ? `Transaction: ${transactionTrace}` : null,
    salesOrderTrace ? `Sales Order: ${salesOrderTrace}` : null,
    orderId ? `${getBaseUrl()}/admin/orders/${orderId}` : null,
    "",
    "TicketPulse Payment Alert",
  ]
    .filter(Boolean)
    .join("\n")
}

// ─── Convenience Alert Functions ─────────────────────────────────────────────

/**
 * Alert when Velocity returns an unexpected response format (e.g. null body,
 * missing expected fields, non-JSON response).
 */
export async function alertVelocityUnexpectedResponse(
  context: string,
  responseSummary: string,
  orderId?: string,
  transactionTrace?: string,
  responseBody?: string,
): Promise<void> {
  await alertPaymentAnomaly({
    type: "VELOCITY_API_UNEXPECTED_FORMAT",
    severity: "medium",
    title: "Velocity returned unexpected response format",
    detail: `While ${context}: ${responseSummary}`,
    orderId,
    transactionTrace,
    context: responseBody ? { responsePreview: responseBody.slice(0, 1000) } : undefined,
  })
}

/**
 * Alert when transaction initiation fails critically (missing trace, missing redirect URL).
 */
export async function alertTransactionFailed(
  reason: string,
  orderId: string,
  paymentMethod: string,
  context: Record<string, unknown>,
): Promise<void> {
  await alertPaymentAnomaly({
    type: "TRANSACTION_API_ERROR",
    severity: "high",
    title: `Payment transaction failed — ${reason}`,
    detail: `Transaction initiation failed for order ${orderId} (${paymentMethod}): ${reason}. ${context.responseBodyPreview ? "See log context for response details." : ""}`,
    orderId,
    paymentMethod,
    context,
  })
}

/**
 * Alert when a payment poll returns an unknown status that requires admin review.
 */
export async function alertPollUnknownStatus(
  orderId: string,
  transactionTrace: string,
  pollStatus: string | null,
  paymentStatus: string | null,
  velocityState: string,
): Promise<void> {
  await alertPaymentAnomaly({
    type: "POLL_UNKNOWN_STATUS",
    severity: "medium",
    title: "Payment poll returned unknown status",
    detail: `Velocity returned an unrecognized payment status for transaction ${transactionTrace}. pollStatus: ${pollStatus ?? "null"}, paymentStatus: ${paymentStatus ?? "null"}, velocityState: ${velocityState}. An admin should review this order.`,
    orderId,
    transactionTrace,
    context: { pollStatus, paymentStatus, velocityState },
  })
}

/**
 * Alert when finalizeWorkflow returns a non-PAID status after poll confirmed success.
 */
export async function alertFinalizeNonPaid(
  orderId: string,
  salesOrderTrace: string,
  salesOrderStatus: string,
  outstandingAmount: number,
): Promise<void> {
  await alertPaymentAnomaly({
    type: "POLL_FINALIZE_NON_PAID",
    severity: "high",
    title: "Workflow finalization returned non-PAID status",
    detail: `Poll confirmed payment success, but finalizeWorkflow returned "${salesOrderStatus}" (outstanding: ${outstandingAmount}). This suggests a reconciliation delay or data inconsistency.`,
    orderId,
    salesOrderTrace,
    context: { salesOrderStatus, outstandingAmount },
  })
}

/**
 * Alert when alarmingly many errors are occurring in the cron recheck.
 */
export async function alertRecheckHighErrorRate(
  checked: number,
  errors: number,
  fixed: number,
  errorDetails: Array<{ orderId: string; reason?: string }>,
): Promise<void> {
  const errorRate = checked > 0 ? Math.round((errors / checked) * 100) : 0
  if (errorRate < 20 && errors < 3) return // Not alarming

  await alertPaymentAnomaly({
    type: "RECHECK_HIGH_ERROR_RATE",
    severity: errorRate > 50 ? "critical" : "high",
    title: `High payment cron error rate — ${errors}/${checked} orders failed`,
    detail: `The recheck-velocity cron found ${checked} pending orders. Fixed: ${fixed}. Errors: ${errors} (${errorRate}% error rate). First 5 failing orders: ${errorDetails.slice(0, 5).map((e) => `${e.orderId.slice(0, 8)}… (${e.reason ?? "unknown"})`).join(", ")}.`,
    context: { checked, fixed, errors, errorRate, sampleErrorDetails: errorDetails.slice(0, 5) },
  })
}

/**
 * Alert when the callback handler receives a notification for an unknown order.
 */
export async function alertCallbackOrderNotFound(
  transactionTrace: string,
  salesOrderTrace: string,
  rawBody: Record<string, unknown> | null,
): Promise<void> {
  await alertPaymentAnomaly({
    type: "CALLBACK_ORDER_NOT_FOUND",
    severity: "high",
    title: "Payment callback received for unknown order",
    detail: `Velocity sent a callback for transaction ${transactionTrace} (sales order ${salesOrderTrace}), but no matching order was found in the database. This indicates a data integrity issue — the Velocity transaction exists but has no local order reference.`,
    transactionTrace,
    salesOrderTrace,
    context: { rawPayloadKeys: rawBody ? Object.keys(rawBody) : null },
  })
}
