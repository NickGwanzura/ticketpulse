"use client"
import { Suspense, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { CheckCircle2, Clock, MessageCircle, ArrowRight, XCircle } from "lucide-react"
import { orderAuthHeaders } from "@/lib/order-auth-client"
import { SUPPORT_WHATSAPP } from "@/lib/order-labels"
import Button from "@/components/ui/Button"

function ExpiredInner() {
  const router = useRouter()
  const params = useSearchParams()
  const orderId = params.get("ref")
  const ref = orderId ? orderId.slice(0, 8).toUpperCase() : null
  const [status, setStatus] = useState<string | null>(null)
  useEffect(() => {
    if (!orderId) return
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout> | null = null
    const startedAt = Date.now()

    const check = async () => {
      try {
        const response = await fetch(`/api/checkout/velocity/status/${encodeURIComponent(orderId)}`, {
          cache: "no-store",
          signal: controller.signal,
          headers: orderAuthHeaders(orderId),
        })
        if (response.ok) {
          const next = await response.json()
          const nextStatus = next.status ?? null
          setStatus(nextStatus)
          if (next.paid) {
            // Late confirmation: take the buyer straight to their tickets.
            router.replace(`/orders/${orderId}?welcome=1`)
            return
          }
          if (["expired", "cancelled", "refunded"].includes(nextStatus)) return
        }
      } catch {
        // Keep the recovery page usable through temporary network failures.
      }

      if (!controller.signal.aborted && Date.now() - startedAt < 10 * 60 * 1000) {
        timer = setTimeout(() => void check(), 10_000)
      }
    }

    void check()
    return () => {
      controller.abort()
      if (timer) clearTimeout(timer)
    }
  }, [orderId, router])
  const paid = status === "paid" || status === "completed"
  const closed = status === "expired" || status === "cancelled"
  const whatsappText = encodeURIComponent(`Hi TicketPulse, I need help with payment reference ${ref ?? "(no reference)"}.`)

  const Icon = paid ? CheckCircle2 : closed ? XCircle : Clock
  const tone = paid
    ? "bg-green-50 ring-green-200 text-green-700"
    : closed
    ? "bg-paper-2 ring-line text-ink-3"
    : "bg-amber-50 ring-amber-200 text-amber-600"

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-5 py-12">
      <div className="max-w-md w-full text-center">
        <span className={`inline-flex w-16 h-16 items-center justify-center rounded-2xl ring-1 mb-6 ${tone}`}>
          <Icon size={28} />
        </span>

        <h1 className="text-[28px] font-bold tracking-tight text-ink leading-tight">
          {paid ? "Payment confirmed" : closed ? "Payment not completed" : "Still confirming your payment"}
        </h1>
        <p className="mt-3 text-[15px] text-ink-2 leading-relaxed">
          {paid
            ? "Your payment is confirmed. Taking you to your tickets…"
            : closed
            ? "This payment didn't go through, so no tickets were issued."
            : "Confirmation is taking longer than usual. Your payment may still complete. Please don't pay again while we keep checking."}
        </p>

        {ref && (
          <p className="mt-4 text-[13px] text-ink-3">
            Reference:{" "}
            <code className="bg-paper-2 border border-line rounded-md px-2 py-0.5 font-mono text-ink-2">
              {ref}
            </code>
          </p>
        )}

        {!paid && (
          <div className="mt-6 rounded-2xl border border-amber-100 bg-amber-50 px-5 py-4 text-left">
            <p className="text-[13px] font-semibold text-amber-900">Was money deducted?</p>
            <p className="mt-1 text-[13px] text-amber-800">
              Don&apos;t pay again. WhatsApp us with the reference above and we&apos;ll check the payment and send your tickets.
            </p>
          </div>
        )}

        <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
          {orderId && (
            <Button href={`/orders/${orderId}${closed ? "" : "?welcome=1"}`} size="lg">
              {closed ? "View order & try again" : "View order"} <ArrowRight size={14} />
            </Button>
          )}
          {!paid && (
            <Button href={`https://wa.me/${SUPPORT_WHATSAPP}?text=${whatsappText}`} variant="secondary" size="lg" target="_blank" rel="noopener noreferrer">
              <MessageCircle size={14} /> WhatsApp support
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

export default function CheckoutExpiredPage() {
  return (
    <Suspense>
      <ExpiredInner />
    </Suspense>
  )
}
