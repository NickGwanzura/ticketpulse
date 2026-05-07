"use client"
import Link from "next/link"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { useCart } from "@/lib/cart-context"
import { formatCurrency } from "@/lib/utils"
import {
  ArrowLeft, ArrowRight, Lock, Smartphone, CreditCard, Banknote, Check, Mail, User, Phone, Loader2,
} from "lucide-react"
import CheckoutSteps from "@/components/CheckoutSteps"

const PAYMENT_METHODS = [
  { value: "ecocash", label: "EcoCash",   body: "Mobile money. Instant.",        icon: Smartphone },
  { value: "card",    label: "Card",      body: "Visa, Mastercard, AmEx.",        icon: CreditCard },
  { value: "paynow",  label: "Paynow",    body: "Online bank transfer.",          icon: Banknote },
  { value: "usd",     label: "USD cash",  body: "Pay at venue. Reserve seat.",    icon: Banknote },
]

export default function CheckoutPage() {
  const router = useRouter()
  const { items, ready, totalsByCurrency, placeOrder } = useCart()
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    payment: "ecocash",
  })

  if (!ready) {
    return (
      <div className="max-w-5xl mx-auto px-5 md:px-8 py-20">
        <div className="h-8 w-40 bg-paper-2 rounded animate-pulse mb-6" />
        <div className="h-64 bg-paper-2 rounded-2xl animate-pulse" />
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-5 md:px-8 py-16 md:py-24 text-center">
        <h1 className="text-[26px] font-bold tracking-tight text-ink">Nothing to check out yet</h1>
        <p className="mt-2 text-[14.5px] text-ink-2">Add tickets to your cart first.</p>
        <Link href="/events" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-navy px-5 py-3 text-sm font-semibold text-white shadow-sm shadow-navy/20 hover:bg-navy-700 transition">
          Browse events <ArrowRight size={14} />
        </Link>
      </div>
    )
  }

  const lineCount = items.reduce((s, i) => s + i.qty, 0)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting) return
    setSubmitting(true)
    // Tiny delay to feel like a real submit
    await new Promise((r) => setTimeout(r, 700))
    const order = placeOrder(
      { name: form.name, email: form.email, phone: form.phone },
      { method: form.payment },
    )
    router.push(`/checkout/success?id=${order.id}`)
  }

  return (
    <div>
      <div className="border-b border-line bg-paper-2">
        <div className="max-w-7xl mx-auto px-5 md:px-8 py-8 md:py-12">
          <Link href="/cart" className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-ink-2 hover:text-ink transition-colors mb-5">
            <ArrowLeft size={13} /> Back to cart
          </Link>
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-5">
            <div>
              <p className="text-[11px] font-semibold tracking-[0.18em] text-blue uppercase mb-2">Checkout</p>
              <h1 className="text-[28px] md:text-[36px] font-bold tracking-tight leading-tight text-ink">
                Almost there.
              </h1>
            </div>
            <div className="w-full md:max-w-md">
              <CheckoutSteps active={form.payment ? "pay" : "details"} />
            </div>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="max-w-7xl mx-auto px-5 md:px-8 py-10 grid lg:grid-cols-[1.5fr_1fr] gap-8 md:gap-10">
        {/* Form */}
        <div className="space-y-6">
          {/* Contact */}
          <section className="rounded-2xl border border-line bg-paper p-6 md:p-7">
            <p className="text-[11px] font-semibold tracking-[0.18em] text-blue uppercase mb-2">01 · Contact</p>
            <h2 className="text-[18px] font-semibold tracking-tight text-ink mb-1">Where do we send your tickets?</h2>
            <p className="text-xs text-ink-3 mb-5">QR codes are emailed and saved in your account.</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-[11.5px] font-medium text-ink-2 mb-1.5">Full name</label>
                <div className="relative">
                  <User size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-3" />
                  <input
                    type="text"
                    required
                    autoComplete="name"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Tendai Moyo"
                    className="w-full bg-paper border border-line rounded-xl pl-10 pr-4 py-3 text-[15px] text-ink placeholder:text-ink-3 focus:outline-none focus:border-blue focus:ring-4 focus:ring-blue/10 transition"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[11.5px] font-medium text-ink-2 mb-1.5">Email</label>
                <div className="relative">
                  <Mail size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-3" />
                  <input
                    type="email"
                    required
                    autoComplete="email"
                    inputMode="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="you@example.com"
                    className="w-full bg-paper border border-line rounded-xl pl-10 pr-4 py-3 text-[15px] text-ink placeholder:text-ink-3 focus:outline-none focus:border-blue focus:ring-4 focus:ring-blue/10 transition"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[11.5px] font-medium text-ink-2 mb-1.5">Phone</label>
                <div className="relative">
                  <Phone size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-3" />
                  <input
                    type="tel"
                    required
                    autoComplete="tel"
                    inputMode="tel"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="+263 77…"
                    className="w-full bg-paper border border-line rounded-xl pl-10 pr-4 py-3 text-[15px] text-ink placeholder:text-ink-3 focus:outline-none focus:border-blue focus:ring-4 focus:ring-blue/10 transition"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Payment */}
          <section className="rounded-2xl border border-line bg-paper p-6 md:p-7">
            <p className="text-[11px] font-semibold tracking-[0.18em] text-blue uppercase mb-2">02 · Payment</p>
            <h2 className="text-[18px] font-semibold tracking-tight text-ink mb-1">How would you like to pay?</h2>
            <p className="text-xs text-ink-3 mb-5">Choose your method, we&apos;ll redirect to confirm.</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {PAYMENT_METHODS.map(({ value, label, body, icon: Icon }) => {
                const checked = form.payment === value
                return (
                  <label
                    key={value}
                    className={`relative cursor-pointer rounded-xl border p-4 transition-all ${
                      checked ? "border-navy bg-blue-soft/40 ring-1 ring-navy/15" : "border-line bg-paper hover:border-line-2"
                    }`}
                  >
                    <input
                      type="radio"
                      name="payment"
                      value={value}
                      checked={checked}
                      onChange={(e) => setForm({ ...form, payment: e.target.value })}
                      className="sr-only"
                    />
                    <div className="flex items-start gap-3">
                      <span className={`shrink-0 inline-flex w-10 h-10 items-center justify-center rounded-xl ring-1 ${
                        checked ? "bg-navy text-white ring-navy/15" : "bg-paper-2 text-ink-2 ring-line"
                      }`}>
                        <Icon size={16} />
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[14px] font-semibold tracking-tight text-ink">{label}</p>
                        <p className="text-[12.5px] text-ink-2 mt-0.5">{body}</p>
                      </div>
                      {checked && <Check size={16} className="text-navy mt-1 shrink-0" />}
                    </div>
                  </label>
                )
              })}
            </div>
          </section>

          {/* Submit (mobile) */}
          <button
            type="submit"
            disabled={submitting}
            className="lg:hidden w-full inline-flex items-center justify-center gap-2 rounded-xl bg-navy px-5 py-3.5 text-[14.5px] font-semibold text-white shadow-sm shadow-navy/20 hover:bg-navy-700 active:scale-[0.99] transition disabled:opacity-90"
          >
            {submitting ? <><Loader2 size={14} className="animate-spin" /> Processing payment…</> : <><Lock size={14} /> Place order</>}
          </button>
        </div>

        {/* Summary */}
        <aside>
          <div className="sticky top-24 rounded-2xl border border-line bg-paper p-6 shadow-sm shadow-ink/[0.04]">
            <h2 className="text-[18px] font-semibold tracking-tight text-ink mb-1">Order summary</h2>
            <p className="text-xs text-ink-3 mb-5">{lineCount} {lineCount === 1 ? "item" : "items"}</p>

            <ul className="space-y-3 mb-5 max-h-72 overflow-y-auto pr-1">
              {items.map((line) => (
                <li key={line.key} className="flex items-start gap-3 text-[12.5px]">
                  <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-line-2 mt-2" />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold tracking-tight text-ink line-clamp-1">
                      {line.kind === "ticket" ? line.tierName : line.kind === "merch" ? line.name : line.description}
                    </p>
                    <p className="text-ink-3 line-clamp-1">{line.eventTitle} · ×{line.qty}</p>
                  </div>
                  <span className="font-semibold tracking-tight text-ink whitespace-nowrap">
                    {formatCurrency(line.price * line.qty, line.currency)}
                  </span>
                </li>
              ))}
            </ul>

            <div className="space-y-2 py-4 border-t border-line">
              {Object.entries(totalsByCurrency).map(([cur, total]) => (
                <div key={cur} className="flex items-baseline justify-between">
                  <span className="text-[13px] text-ink-2">Subtotal · {cur}</span>
                  <span className="text-[16px] font-bold tracking-tight text-ink">
                    {formatCurrency(total, cur)}
                  </span>
                </div>
              ))}
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="hidden lg:inline-flex w-full items-center justify-center gap-2 rounded-xl bg-navy px-5 py-3.5 text-[14.5px] font-semibold text-white shadow-sm shadow-navy/20 hover:bg-navy-700 active:scale-[0.99] transition disabled:opacity-90 mt-2"
            >
              {submitting ? <><Loader2 size={14} className="animate-spin" /> Processing payment…</> : <><Lock size={14} /> Place order</>}
            </button>

            <p className="mt-3 text-[11.5px] text-ink-3 text-center inline-flex items-center justify-center gap-1.5 w-full">
              <Lock size={11} /> Secured by TicketPulse · escrowed
            </p>
          </div>
        </aside>
      </form>
    </div>
  )
}
