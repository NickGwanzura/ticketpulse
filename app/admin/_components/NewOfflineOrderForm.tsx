"use client"

import { useActionState, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { CheckCircle2, XCircle } from "lucide-react"
import { createOfflineOrderAction } from "@/app/admin/actions/orders"
import { formatCurrency } from "@/lib/utils"

type Tier = {
  id: string
  name: string
  price: string
  currency: string
  remaining: number
}

type EventOption = {
  id: string
  title: string
  status: string | null
  tiers: Tier[]
}

type ActionState = { ok: boolean; message: string; orderId?: string } | null

function inputCls(hasError?: boolean) {
  return [
    "w-full rounded-xl border bg-paper px-4 py-3 text-[14px] text-ink placeholder:text-ink-3",
    "focus:outline-none focus:ring-2 focus:ring-blue/30 focus:border-green-500 transition",
    hasError ? "border-red-400" : "border-line",
  ].join(" ")
}

export default function NewOfflineOrderForm({ events }: { events: EventOption[] }) {
  const router = useRouter()
  const [eventId, setEventId] = useState(events[0]?.id ?? "")
  const [tierId, setTierId] = useState(events[0]?.tiers[0]?.id ?? "")
  const [quantity, setQuantity] = useState(1)
  const [guestName, setGuestName] = useState("")
  const [guestEmail, setGuestEmail] = useState("")
  const [guestPhone, setGuestPhone] = useState("")
  const [paymentMethod, setPaymentMethod] = useState("cash")
  const [paymentRef, setPaymentRef] = useState("")

  const selectedEvent = useMemo(() => events.find((e) => e.id === eventId), [events, eventId])
  const selectedTier = useMemo(() => selectedEvent?.tiers.find((t) => t.id === tierId), [selectedEvent, tierId])

  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    async () => {
      try {
        const result = await createOfflineOrderAction({
          eventId,
          tierId,
          quantity,
          guestName,
          guestEmail,
          guestPhone: guestPhone || undefined,
          paymentMethod,
          paymentRef: paymentRef || undefined,
        })
        if (result.success) {
          router.refresh()
        }
        return { ok: result.success, message: result.message, orderId: result.orderId }
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Failed to create order"
        return { ok: false, message: msg }
      }
    },
    null,
  )

  if (events.length === 0) {
    return (
      <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-[13px] text-amber-800">
        No events with available ticket tiers found.
      </div>
    )
  }

  return (
    <form action={formAction} className="rounded-2xl border border-line bg-paper p-6 md:p-8 space-y-5">
      <div>
        <label className="block text-[12px] font-semibold text-ink-2 mb-1.5">Event</label>
        <select
          className={inputCls()}
          value={eventId}
          onChange={(e) => {
            setEventId(e.target.value)
            const ev = events.find((ev2) => ev2.id === e.target.value)
            setTierId(ev?.tiers[0]?.id ?? "")
          }}
        >
          {events.map((ev) => (
            <option key={ev.id} value={ev.id}>{ev.title}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-[12px] font-semibold text-ink-2 mb-1.5">Ticket tier</label>
        <select className={inputCls()} value={tierId} onChange={(e) => setTierId(e.target.value)}>
          {selectedEvent?.tiers.map((t) => (
            <option key={t.id} value={t.id} disabled={t.remaining < 1}>
              {t.name} — {formatCurrency(Number(t.price), t.currency)} ({t.remaining} left)
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-[12px] font-semibold text-ink-2 mb-1.5">Quantity</label>
        <input
          type="number"
          min={1}
          max={selectedTier?.remaining ?? 1}
          className={inputCls()}
          value={quantity}
          onChange={(e) => setQuantity(parseInt(e.target.value, 10) || 1)}
        />
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-[12px] font-semibold text-ink-2 mb-1.5">Guest name</label>
          <input
            className={inputCls()}
            value={guestName}
            onChange={(e) => setGuestName(e.target.value)}
            placeholder="Jane Doe"
          />
        </div>
        <div>
          <label className="block text-[12px] font-semibold text-ink-2 mb-1.5">Guest email</label>
          <input
            type="email"
            className={inputCls()}
            value={guestEmail}
            onChange={(e) => setGuestEmail(e.target.value)}
            placeholder="jane@example.com"
          />
        </div>
      </div>

      <div>
        <label className="block text-[12px] font-semibold text-ink-2 mb-1.5">Guest phone (optional)</label>
        <input
          className={inputCls()}
          value={guestPhone}
          onChange={(e) => setGuestPhone(e.target.value)}
          placeholder="07XXXXXXXX"
        />
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-[12px] font-semibold text-ink-2 mb-1.5">Payment method</label>
          <select className={inputCls()} value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
            <option value="cash">Cash</option>
            <option value="bank_transfer">Bank transfer</option>
            <option value="mobile_money">Mobile money</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div>
          <label className="block text-[12px] font-semibold text-ink-2 mb-1.5">Payment reference (optional)</label>
          <input
            className={inputCls()}
            value={paymentRef}
            onChange={(e) => setPaymentRef(e.target.value)}
            placeholder="Receipt / transaction ref"
          />
        </div>
      </div>

      {selectedTier && (
        <p className="text-[12px] text-ink-3">
          Total: {formatCurrency(Number(selectedTier.price) * quantity, selectedTier.currency)}
        </p>
      )}

      <button
        type="submit"
        disabled={pending || !guestName || !guestEmail || !selectedTier || quantity > (selectedTier?.remaining ?? 0)}
        className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-5 py-3 text-[13px] font-semibold text-white shadow-sm shadow-brand-600/20 hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
      >
        {pending ? "Issuing ticket…" : "Issue ticket & send email"}
      </button>

      {state && (
        <div
          className={`rounded-xl border px-4 py-3 text-[13px] flex items-center gap-2 ${
            state.ok
              ? "bg-green-50 border-brand-200 text-green-800"
              : "bg-red-50 border-red-200 text-red-700"
          }`}
        >
          {state.ok ? <CheckCircle2 size={14} className="shrink-0" /> : <XCircle size={14} className="shrink-0" />}
          {state.message}
        </div>
      )}
    </form>
  )
}
