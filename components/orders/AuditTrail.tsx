"use client"

import {
  ShoppingCart, CreditCard, Mail, Ticket, Send,
  RotateCcw, CheckCircle2, AlertTriangle, Clock, UserCheck,
} from "lucide-react"

interface AuditEvent {
  timestamp: Date | null
  icon: React.ElementType
  iconColor: string
  iconBg: string
  title: string
  detail?: string
}

interface Props {
  order: {
    status: string
    createdAt: Date | null
    paidAt: Date | null
    verifiedAt: Date | null
    completedAt: Date | null
    verificationSentAt: Date | null
    metadata: unknown
  }
}

export default function AuditTrail({ order }: Props) {
  const meta = (order.metadata ?? {}) as Record<string, unknown>
  const delivery = meta.delivery as Record<string, unknown> | undefined
  const velocity = meta.velocity as Record<string, unknown> | undefined

  const events: AuditEvent[] = [
    {
      timestamp: order.createdAt,
      icon: ShoppingCart,
      iconColor: "text-sky-600",
      iconBg: "bg-sky-50",
      title: "Order created",
      detail: "Checkout initiated",
    },
  ]

  if (order.verificationSentAt) {
    events.push({
      timestamp: order.verificationSentAt,
      icon: Mail,
      iconColor: "text-blue-600",
      iconBg: "bg-blue-50",
      title: "Verification email sent",
      detail: "Magic link dispatched to buyer",
    })
  }

  if (order.paidAt) {
    events.push({
      timestamp: order.paidAt,
      icon: CreditCard,
      iconColor: "text-emerald-600",
      iconBg: "bg-emerald-50",
      title: "Payment confirmed",
      detail: velocity?.pollStatus ? `Velocity: ${velocity.pollStatus}` : undefined,
    })
  }

  if (delivery?.ticketIssuedAt) {
    events.push({
      timestamp: new Date(delivery.ticketIssuedAt as string),
      icon: Ticket,
      iconColor: "text-violet-600",
      iconBg: "bg-violet-50",
      title: "Tickets generated",
      detail: `${delivery.ticketCount ?? "?"} ticket(s) created`,
    })
  }

  if (delivery?.emailSentAt) {
    events.push({
      timestamp: new Date(delivery.emailSentAt as string),
      icon: Send,
      iconColor: "text-emerald-600",
      iconBg: "bg-emerald-50",
      title: "Confirmation email sent",
      detail: delivery.status === "EMAIL_FAILED" ? "Failed — will retry" : undefined,
    })
  }

  if (order.verifiedAt) {
    events.push({
      timestamp: order.verifiedAt,
      icon: UserCheck,
      iconColor: "text-emerald-600",
      iconBg: "bg-emerald-50",
      title: "Buyer verified email",
    })
  }

  if (order.completedAt) {
    events.push({
      timestamp: order.completedAt,
      icon: CheckCircle2,
      iconColor: "text-emerald-600",
      iconBg: "bg-emerald-50",
      title: "Order manually completed",
    })
  }

  if (order.status === "refunded") {
    events.push({
      timestamp: null,
      icon: RotateCcw,
      iconColor: "text-rose-600",
      iconBg: "bg-rose-50",
      title: "Order refunded",
    })
  }

  if (order.status === "expired") {
    events.push({
      timestamp: null,
      icon: Clock,
      iconColor: "text-gray-500",
      iconBg: "bg-gray-50",
      title: "Order expired",
      detail: "Not completed within time limit",
    })
  }

  if (order.status === "cancelled") {
    events.push({
      timestamp: null,
      icon: AlertTriangle,
      iconColor: "text-rose-600",
      iconBg: "bg-rose-50",
      title: "Order cancelled",
    })
  }

  const sorted = events.sort((a, b) => {
    if (!a.timestamp && !b.timestamp) return 0
    if (!a.timestamp) return 1
    if (!b.timestamp) return -1
    return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  })

  return (
    <div className="rounded-2xl border border-line bg-paper overflow-hidden">
      <div className="px-5 md:px-6 py-4 border-b border-line">
        <h3 className="text-[15px] font-semibold tracking-tight text-ink">Audit trail</h3>
      </div>
      <div className="p-5 md:p-6">
        <ol className="relative space-y-4">
          <span className="absolute left-[15px] top-2 bottom-2 w-px bg-line" aria-hidden />
          {sorted.map((event, i) => {
            const Icon = event.icon
            return (
              <li key={i} className="relative pl-8">
                <span
                  className={`absolute left-0 top-0.5 w-7 h-7 rounded-full ${event.iconBg} flex items-center justify-center ring-4 ring-white`}
                >
                  <Icon size={14} className={event.iconColor} />
                </span>
                <div>
                  <p className="text-[14px] font-medium text-ink">{event.title}</p>
                  {event.detail && (
                    <p className="text-[13px] text-ink-3 mt-0.5">{event.detail}</p>
                  )}
                  {event.timestamp && (
                    <p className="text-[12px] text-ink-3 mt-0.5">
                      {new Date(event.timestamp).toLocaleString()}
                    </p>
                  )}
                </div>
              </li>
            )
          })}
        </ol>
      </div>
    </div>
  )
}
