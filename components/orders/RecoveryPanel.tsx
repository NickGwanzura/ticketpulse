"use client"

import { useMemo } from "react"
import {
  AlertTriangle, CheckCircle2, Clock, Mail, CreditCard,
  Ticket, RotateCcw, Send, Ban, ArrowRight,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface OrderStatus {
  id: string
  status: string
  paymentMethod: string | null
  metadata: unknown
  createdAt: Date | null
  paidAt: Date | null
  verificationSentAt: Date | null
  verifiedAt: Date | null
  completedAt?: Date | null
}

interface Diagnosis {
  severity: "ok" | "warning" | "critical"
  headline: string
  detail: string
  primaryAction?: {
    label: string
    icon: React.ElementType
    action: () => void
  }
  secondaryAction?: {
    label: string
    href: string
  }
}

function diagnoseOrder(order: OrderStatus): Diagnosis {
  const meta = (order.metadata ?? {}) as Record<string, unknown>
  const velocity = meta.velocity as Record<string, unknown> | undefined
  const delivery = meta.delivery as Record<string, unknown> | undefined
  const pollStatus = velocity?.pollStatus as string | undefined
  const now = Date.now()
  const createdMs = order.createdAt ? new Date(order.createdAt).getTime() : null
  const hoursSinceCreated = createdMs ? (now - createdMs) / (1000 * 60 * 60) : 0

  // Critical: Payment failed
  if (order.status === "refunded" || order.status === "cancelled") {
    return {
      severity: "critical",
      headline: order.status === "refunded" ? "Order refunded" : "Order cancelled",
      detail: "This order is in a terminal state. No further action is possible.",
    }
  }

  // Critical: Expired
  if (order.status === "expired") {
    return {
      severity: "critical",
      headline: "Order expired",
      detail: "This order was not completed within the time limit.",
      primaryAction: {
        label: "Recreate order",
        icon: RotateCcw,
        action: () => {}, // Would trigger recreate flow
      },
    }
  }

  // Warning: Pending for too long
  if (order.status === "pending") {
    if (hoursSinceCreated > 2) {
      return {
        severity: "warning",
        headline: `Payment pending for ${Math.floor(hoursSinceCreated)} hours`,
        detail: pollStatus === "FAILED"
          ? "Velocity reported a failed payment. The buyer may need to retry."
          : "The buyer may have abandoned checkout or the payment processor is slow.",
        primaryAction: {
          label: "Recheck payment",
          icon: CreditCard,
          action: () => {}, // Would trigger recheck
        },
      }
    }
    return {
      severity: "ok",
      headline: "Payment in progress",
      detail: "The buyer has initiated payment. This usually resolves within minutes.",
    }
  }

  // Warning: Awaiting verification for too long
  if (order.status === "awaiting_verification") {
    const sentMs = order.verificationSentAt ? new Date(order.verificationSentAt).getTime() : null
    const hoursSinceSent = sentMs ? (now - sentMs) / (1000 * 60 * 60) : 0

    if (hoursSinceSent > 4) {
      return {
        severity: "warning",
        headline: `Awaiting email verification for ${Math.floor(hoursSinceSent)} hours`,
        detail: "The buyer has not clicked the magic link. The email may be in spam or the address is incorrect.",
        primaryAction: {
          label: "Resend verification",
          icon: Mail,
          action: () => {},
        },
      }
    }
    return {
      severity: "ok",
      headline: "Awaiting email verification",
      detail: "A magic link has been sent to the buyer's email. They need to click it to claim tickets.",
    }
  }

  // Paid: Check delivery
  if (order.status === "paid" || order.status === "completed") {
    const deliveryStatus = delivery?.status as string | undefined

    if (deliveryStatus === "EMAIL_FAILED" || deliveryStatus === "FAILED") {
      return {
        severity: "warning",
        headline: "Ticket delivery failed",
        detail: "The tickets were generated but the email could not be delivered. This may be a temporary issue.",
        primaryAction: {
          label: "Resend tickets",
          icon: Send,
          action: () => {},
        },
      }
    }

    if (deliveryStatus === "NOT_STARTED" || !deliveryStatus) {
      return {
        severity: "warning",
        headline: "Tickets not yet delivered",
        detail: "Payment is confirmed but ticket generation has not started. This is unusual.",
        primaryAction: {
          label: "Send tickets",
          icon: Ticket,
          action: () => {},
        },
      }
    }

    return {
      severity: "ok",
      headline: "Order complete",
      detail: "Payment confirmed, tickets generated, and email delivered successfully.",
    }
  }

  return {
    severity: "ok",
    headline: "Order status unknown",
    detail: "Unable to determine the order state automatically.",
  }
}

export default function RecoveryPanel({ order }: { order: OrderStatus }) {
  const diagnosis = useMemo(() => diagnoseOrder(order), [order])

  const severityStyles = {
    ok: "border-emerald-200 bg-emerald-50/60",
    warning: "border-amber-200 bg-amber-50/60",
    critical: "border-rose-200 bg-rose-50/60",
  }

  const severityIcon = {
    ok: CheckCircle2,
    warning: AlertTriangle,
    critical: Ban,
  }

  const Icon = severityIcon[diagnosis.severity]

  return (
    <div className={cn("rounded-2xl border p-5", severityStyles[diagnosis.severity])}>
      <div className="flex items-start gap-3">
        <div className="shrink-0 mt-0.5">
          <Icon
            size={18}
            className={
              diagnosis.severity === "ok"
                ? "text-emerald-600"
                : diagnosis.severity === "warning"
                ? "text-amber-600"
                : "text-rose-600"
            }
          />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-semibold text-ink">{diagnosis.headline}</p>
          <p className="text-[13px] text-ink-2 mt-1">{diagnosis.detail}</p>

          {diagnosis.primaryAction && (
            <div className="flex items-center gap-3 mt-4">
              <button
                onClick={diagnosis.primaryAction.action}
                className={cn(
                  "inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-[13.5px] font-semibold transition-colors",
                  diagnosis.severity === "warning"
                    ? "bg-amber-600 text-white hover:bg-amber-700"
                    : "bg-rose-600 text-white hover:bg-rose-700"
                )}
              >
                <diagnosis.primaryAction.icon size={14} />
                {diagnosis.primaryAction.label}
              </button>
              {diagnosis.secondaryAction && (
                <a
                  href={diagnosis.secondaryAction.href}
                  className="inline-flex items-center gap-1 text-[13px] font-medium text-navy hover:underline"
                >
                  {diagnosis.secondaryAction.label} <ArrowRight size={12} />
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
