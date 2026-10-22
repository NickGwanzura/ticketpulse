"use client"

import { useState, type FormEvent } from "react"

interface EnquiryFormProps {
  vendorSlug: string
  vendorName: string
}

interface FormState {
  date: string
  guestCount: string
  name: string
  email: string
  phone: string
  message: string
}

interface ValidationErrors {
  date?: string
  guestCount?: string
  name?: string
  email?: string
  message?: string
}

function validateEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function validate(state: FormState): ValidationErrors {
  const errors: ValidationErrors = {}
  if (!state.date) errors.date = "Choose an event date."
  else if (new Date(`${state.date}T23:59:59+02:00`) < new Date()) errors.date = "Choose today or a future date."
  if (state.guestCount && (!Number.isInteger(Number(state.guestCount)) || Number(state.guestCount) < 1)) {
    errors.guestCount = "Enter a valid guest count."
  }
  if (!state.name.trim()) errors.name = "Name is required."
  if (!state.email.trim()) {
    errors.email = "Email is required."
  } else if (!validateEmail(state.email)) {
    errors.email = "Enter a valid email address."
  }
  if (state.message.trim().length < 10) errors.message = "Message must be at least 10 characters."
  return errors
}

export default function EnquiryForm({ vendorSlug, vendorName }: EnquiryFormProps) {
  const [form, setForm] = useState<FormState>({ date: "", guestCount: "", name: "", email: "", phone: "", message: "" })
  const [errors, setErrors] = useState<ValidationErrors>({})
  const [submitting, setSubmitting] = useState(false)
  const [notificationSent, setNotificationSent] = useState<boolean | null>(null)
  const [submitError, setSubmitError] = useState("")

  function handleChange(field: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
    if (errors[field as keyof ValidationErrors]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }))
    }
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const validation = validate(form)
    if (Object.keys(validation).length > 0) {
      setErrors(validation)
      return
    }
    setSubmitting(true)
    setSubmitError("")
    try {
      const res = await fetch(`/api/vendors/${encodeURIComponent(vendorSlug)}/enquire`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim() || undefined,
          message: form.message.trim(),
          eventDate: form.date,
          guestCount: form.guestCount ? Number(form.guestCount) : undefined,
        }),
      })
      const result = await res.json().catch(() => null)
      if (!res.ok || !result?.ok) {
        setSubmitError(result?.error ?? "We could not save your request. Please try again.")
        return
      }
      setNotificationSent(result.notificationSent === true)
    } catch {
      setSubmitError("We could not connect. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  if (notificationSent !== null) {
    return (
      <div className="py-6 text-center">
        <p className="text-[15px] font-semibold text-ink mb-1">Your booking request is saved.</p>
        <p className="text-[13px] text-ink-3">
          {notificationSent ? "The vendor has been notified." : "TicketPulse will follow up on the notification."}
          {" "}The vendor must confirm availability and price before anything is booked.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-3 mb-5">
      <p className="text-[11px] font-semibold tracking-[0.18em] text-blue uppercase mb-1">Booking request</p>
      <h2 className="text-[18px] font-semibold tracking-tight text-ink mb-1">
        Request {vendorName.split(" ")[0]} for your event
      </h2>
      <p className="text-xs text-ink-3 mb-5">Share your event details to ask for availability and a quote.</p>

      {submitError && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-[12px] text-rose-700">{submitError}</p>}

      <div>
        <label htmlFor="vendor-event-date" className="block text-[11px] font-medium text-ink-2 mb-1.5">Event date (required)</label>
        <input
          id="vendor-event-date"
          type="date"
          required
          value={form.date}
          onChange={(e) => handleChange("date", e.target.value)}
          className="w-full bg-paper border border-line rounded-xl px-3.5 py-2.5 text-[14px] text-ink focus:outline-none focus:border-green-500 focus:ring-4 focus:ring-brand-500/10 transition"
        />
        {errors.date && <p className="mt-1 text-[12px] text-rose-600">{errors.date}</p>}
      </div>
      <div>
        <label className="block text-[11px] font-medium text-ink-2 mb-1.5">Guest count</label>
        <input
          type="number"
          min="1"
          placeholder="e.g. 250"
          value={form.guestCount}
          onChange={(e) => handleChange("guestCount", e.target.value)}
          className="w-full bg-paper border border-line rounded-xl px-3.5 py-2.5 text-[14px] text-ink placeholder:text-ink-3 focus:outline-none focus:border-green-500 focus:ring-4 focus:ring-brand-500/10 transition"
        />
        {errors.guestCount && <p className="mt-1 text-[12px] text-rose-600">{errors.guestCount}</p>}
      </div>
      <div>
        <label className="block text-[11px] font-medium text-ink-2 mb-1.5">
          Your name <span className="text-ink-3">(required)</span>
        </label>
        <input
          type="text"
          placeholder="Full name"
          value={form.name}
          onChange={(e) => handleChange("name", e.target.value)}
          className={`w-full bg-paper border rounded-xl px-3.5 py-2.5 text-[14px] text-ink placeholder:text-ink-3 focus:outline-none focus:ring-4 transition ${errors.name ? "border-rose-400 focus:border-rose-400 focus:ring-rose-100" : "border-line focus:border-green-500 focus:ring-brand-500/10"}`}
        />
        {errors.name && <p className="mt-1 text-[12px] text-rose-600">{errors.name}</p>}
      </div>
      <div>
        <label className="block text-[11px] font-medium text-ink-2 mb-1.5">
          Email <span className="text-ink-3">(required)</span>
        </label>
        <input
          type="email"
          placeholder="you@example.com"
          value={form.email}
          onChange={(e) => handleChange("email", e.target.value)}
          className={`w-full bg-paper border rounded-xl px-3.5 py-2.5 text-[14px] text-ink placeholder:text-ink-3 focus:outline-none focus:ring-4 transition ${errors.email ? "border-rose-400 focus:border-rose-400 focus:ring-rose-100" : "border-line focus:border-green-500 focus:ring-brand-500/10"}`}
        />
        {errors.email && <p className="mt-1 text-[12px] text-rose-600">{errors.email}</p>}
      </div>
      <div>
        <label htmlFor="vendor-contact-phone" className="block text-[11px] font-medium text-ink-2 mb-1.5">Phone (optional)</label>
        <input
          id="vendor-contact-phone"
          type="tel"
          placeholder="+263 7…"
          value={form.phone}
          onChange={(e) => handleChange("phone", e.target.value)}
          className="w-full bg-paper border border-line rounded-xl px-3.5 py-2.5 text-[14px] text-ink placeholder:text-ink-3 focus:outline-none focus:border-green-500 focus:ring-4 focus:ring-brand-500/10 transition"
        />
      </div>
      <div>
        <label className="block text-[11px] font-medium text-ink-2 mb-1.5">
          Notes <span className="text-ink-3">(required)</span>
        </label>
        <textarea
          rows={3}
          placeholder="What are you planning?"
          value={form.message}
          onChange={(e) => handleChange("message", e.target.value)}
          className={`w-full bg-paper border rounded-xl px-3.5 py-2.5 text-[14px] text-ink placeholder:text-ink-3 focus:outline-none focus:ring-4 transition resize-none ${errors.message ? "border-rose-400 focus:border-rose-400 focus:ring-rose-100" : "border-line focus:border-green-500 focus:ring-brand-500/10"}`}
        />
        {errors.message && <p className="mt-1 text-[12px] text-rose-600">{errors.message}</p>}
      </div>
      <button
        type="submit"
        disabled={submitting}
        className="w-full bg-brand-600 text-white font-semibold py-3 rounded-xl hover:bg-brand-700 active:scale-[0.99] transition shadow-sm shadow-brand-600/20 text-sm disabled:opacity-60 disabled:cursor-wait"
      >
        {submitting ? "Sending..." : "Request availability"}
      </button>
      <p className="text-[11px] text-ink-3">No payment is taken. This request does not confirm a booking.</p>
    </form>
  )
}
