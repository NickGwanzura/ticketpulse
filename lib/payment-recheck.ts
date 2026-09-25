import "server-only"

import { deliverTicketForPaidOrder } from "@/lib/delivery"
import { log } from "@/lib/logger"
import { reconcileVelocityOrder } from "@/lib/velocity/reconciliation"

export type RecheckResult = { fixed: boolean; message: string; details?: Record<string, unknown> }

/**
 * Ask Velocity for the order's real payment state, settle it atomically if it
 * was paid, and deliver tickets. Read-only toward the provider, so it is safe
 * for anyone authorised to act on the order (admin or its organiser).
 * Callers must authorise first.
 */
export async function recheckOrderPayment(
  orderId: string,
  opts: { source: string; actorEmail?: string | null },
): Promise<RecheckResult> {
  const result = await reconcileVelocityOrder({
    orderId,
    source: opts.source,
    actorEmail: opts.actorEmail,
  })

  if (!result.paid) {
    return {
      fixed: false,
      message: `${result.state}: ${result.message ?? "Payment was not confirmed"}`,
      details: {
        state: result.state,
        transactionTrace: result.transactionTrace,
        salesOrderTrace: result.salesOrderTrace,
        providerHttpStatus: result.providerHttpStatus,
      },
    }
  }

  try {
    const delivery = await deliverTicketForPaidOrder(orderId)
    return {
      fixed: true,
      message: `Payment confirmed and every local completion field was updated atomically. Delivery: ${delivery.status}; tickets: ${delivery.ticketCount}; email: ${delivery.emailSent ? "sent" : delivery.error ?? "pending retry"}.`,
      details: {
        invoiceId: result.invoiceId,
        transactionTrace: result.transactionTrace,
        newlySettled: result.newlySettled,
      },
    }
  } catch (error) {
    log.error("recheckOrderPayment - delivery failed after atomic settlement", { orderId, error: String(error) })
    return {
      fixed: true,
      message: `Payment and ledger were fixed, but ticket delivery failed and will be retried by cron: ${error instanceof Error ? error.message : String(error)}`,
      details: { invoiceId: result.invoiceId, transactionTrace: result.transactionTrace },
    }
  }
}

