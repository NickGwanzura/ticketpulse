"use client"

import { useState } from "react"
import { Star, Send, CheckCircle2 } from "lucide-react"

type ReviewFormProps = {
  eventId: string | null
  eventTitle?: string | null
  initialName?: string
  initialEmail?: string
  initialOrderRef?: string
}

type SubmitState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success" }
  | { status: "error"; message: string }

export default function ReviewForm({
  eventId,
  eventTitle,
  initialName = "",
  initialEmail = "",
  initialOrderRef = "",
}: ReviewFormProps) {
  const [rating, setRating] = useState(5)
  const [state, setState] = useState<SubmitState>({ status: "idle" })

  async function onSubmit(formData: FormData) {
    setState({ status: "loading" })

    const payload = {
      eventId,
      name: String(formData.get("name") ?? ""),
      email: String(formData.get("email") ?? ""),
      orderRef: String(formData.get("orderRef") ?? ""),
      rating,
      title: String(formData.get("title") ?? ""),
      body: String(formData.get("body") ?? ""),
      publicConsent: formData.get("publicConsent") === "on",
    }

    const res = await fetch("/api/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      const data = await res.json().catch(() => null)
      setState({ status: "error", message: data?.error ?? "Could not submit review" })
      return
    }

    setState({ status: "success" })
  }

  if (state.status === "success") {
    return (
      <div className="rounded-2xl border border-green-200 bg-green-50 p-6 text-center">
        <CheckCircle2 className="mx-auto mb-3 text-green-700" size={32} />
        <h2 className="text-[20px] font-bold tracking-tight text-ink">Review received</h2>
        <p className="mt-2 text-[14px] leading-6 text-ink-2">
          Thank you. Your review has been sent to the TicketPulse team for approval.
        </p>
      </div>
    )
  }

  return (
    <form action={onSubmit} className="rounded-2xl border border-line bg-paper p-5 md:p-6 space-y-5">
      <div>
        <p className="text-[11px] font-semibold tracking-[0.16em] text-blue uppercase">Review</p>
        <h1 className="mt-1 text-[24px] md:text-[28px] font-bold tracking-tight text-ink">
          {eventTitle ? `How was your TicketPulse experience at ${eventTitle}?` : "How was your TicketPulse experience?"}
        </h1>
      </div>

      <div className="flex items-center gap-2" aria-label="Rating">
        {[1, 2, 3, 4, 5].map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setRating(value)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-line bg-paper-2 hover:bg-paper transition"
            aria-label={`${value} star${value === 1 ? "" : "s"}`}
          >
            <Star size={19} className={value <= rating ? "fill-amber-400 text-amber-500" : "text-ink-3"} />
          </button>
        ))}
        <span className="ml-1 text-[13px] font-semibold text-ink">{rating}/5</span>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <label className="block">
          <span className="text-[13px] font-semibold text-ink">Name</span>
          <input
            name="name"
            defaultValue={initialName}
            required
            maxLength={120}
            className="mt-1.5 w-full rounded-xl border border-line bg-paper-2 px-3.5 py-3 text-[14px] outline-none focus:border-blue"
          />
        </label>
        <label className="block">
          <span className="text-[13px] font-semibold text-ink">Email <span className="font-normal text-ink-3">(optional)</span></span>
          <input
            name="email"
            type="email"
            defaultValue={initialEmail}
            maxLength={160}
            placeholder="Not shown publicly"
            className="mt-1.5 w-full rounded-xl border border-line bg-paper-2 px-3.5 py-3 text-[14px] outline-none focus:border-blue"
          />
        </label>
      </div>

      <label className="block">
        <span className="text-[13px] font-semibold text-ink">Order reference</span>
        <input
          name="orderRef"
          defaultValue={initialOrderRef}
          maxLength={80}
          placeholder="Optional"
          className="mt-1.5 w-full rounded-xl border border-line bg-paper-2 px-3.5 py-3 text-[14px] outline-none focus:border-blue"
        />
      </label>

      <label className="block">
        <span className="text-[13px] font-semibold text-ink">Short headline</span>
        <input
          name="title"
          maxLength={120}
          placeholder="Easy checkout and fast ticket delivery"
          className="mt-1.5 w-full rounded-xl border border-line bg-paper-2 px-3.5 py-3 text-[14px] outline-none focus:border-blue"
        />
      </label>

      <label className="block">
        <span className="text-[13px] font-semibold text-ink">Your TicketPulse service review</span>
        <textarea
          name="body"
          required
          minLength={10}
          maxLength={1200}
          rows={6}
          className="mt-1.5 w-full resize-y rounded-xl border border-line bg-paper-2 px-3.5 py-3 text-[14px] leading-6 outline-none focus:border-blue"
        />
      </label>

      <label className="flex items-start gap-2 text-[13px] leading-5 text-ink-2">
        <input name="publicConsent" type="checkbox" defaultChecked className="mt-1" />
        <span>TicketPulse may show this review publicly with my first name and rating after moderation.</span>
      </label>

      {state.status === "error" && (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-[13px] font-medium text-rose-700">
          {state.message}
        </p>
      )}

      <button
        type="submit"
        disabled={state.status === "loading"}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-navy px-4 py-3 text-[14px] font-semibold text-white hover:bg-ink disabled:opacity-60 transition"
      >
        <Send size={16} />
        {state.status === "loading" ? "Sending..." : "Send review"}
      </button>
    </form>
  )
}
