"use client"
import Link from "next/link"
import { Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { Clock, ArrowRight, Mail } from "lucide-react"

function ExpiredInner() {
  const params = useSearchParams()
  const orderId = params.get("ref")
  const ref = orderId ? orderId.slice(0, 8).toUpperCase() : null

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-5">
      <div className="max-w-md w-full text-center">
        <span className="inline-flex w-16 h-16 items-center justify-center rounded-2xl bg-amber-50 ring-1 ring-amber-200 mb-6">
          <Clock size={28} className="text-amber-600" />
        </span>

        <h1 className="text-[28px] font-bold tracking-tight text-ink leading-tight">
          Payment window expired
        </h1>
        <p className="mt-3 text-[15px] text-ink-2 leading-relaxed">
          We didn&apos;t receive payment confirmation in time. Your reservation has been released back into the pool.
        </p>

        {ref && (
          <p className="mt-4 text-[13px] text-ink-3">
            Reference:{" "}
            <code className="bg-paper-2 border border-line rounded-md px-2 py-0.5 font-mono text-ink-2">
              {ref}
            </code>
          </p>
        )}

        <div className="mt-6 rounded-2xl border border-amber-100 bg-amber-50 px-5 py-4 text-left space-y-1.5">
          <p className="text-[13px] font-semibold text-amber-800">Was money deducted?</p>
          <p className="text-[13px] text-amber-700">
            If your EcoCash or card was charged, your tickets will be delivered automatically once the payment clears — you don&apos;t need to do anything.
          </p>
          <p className="text-[13px] text-amber-700">
            Contact us with your reference number and we&apos;ll sort it out promptly.
          </p>
        </div>

        <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/events"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0a2540] px-5 py-3 text-[14px] font-semibold text-white shadow-sm hover:bg-[#0d2f4f] transition"
          >
            Try again <ArrowRight size={14} />
          </Link>
          <Link
            href="/contact"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-line bg-paper px-5 py-3 text-[14px] font-semibold text-ink hover:border-line-2 transition"
          >
            <Mail size={14} /> Contact support
          </Link>
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
