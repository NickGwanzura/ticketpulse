"use client"

import { useState, type FormEvent } from "react"

const STORAGE_KEY = "vendor_enquiries"

interface EnquiryFormProps {
  vendorSlug: string
  vendorId: string
  vendorName: string
  responseTimeHours: number
}

interface FormState {
  date: string
  guestCount: string
  name: string
  email: string
  message: string
}

interface ValidationErrors {
  name?: string
  email?: string
  message?: string
}

function validateEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function validate(state: FormState): ValidationErrors {
  const errors: ValidationErrors = {}
  if (!state.name.trim()) errors.name = "Name is required."
  if (!state.email.trim()) {
    errors.email = "Email is required."
  } else if (!validateEmail(state.email)) {
    errors.email = "Enter a valid email address."
  }
  if (state.message.trim().length < 10) errors.message = "Message must be at least 10 characters."
  return errors
}

export default function EnquiryForm({ vendorSlug, vendorId, vendorName, responseTimeHours }: EnquiryFormProps) {
  const [form, setForm] = useState<FormState>({ date: "", guestCount: "", name: "", email: "", message: "" })
  const [errors, setErrors] = useState<ValidationErrors>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

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
    try {
      const enquiry = {
        vendorSlug,
        vendorName,
        submittedAt: new Date().toISOString(),
        ...form,
      }
      // Always persist locally as a backup so we don't lose the enquiry
      // even if the API call below fails.
      try {
        const existing: unknown[] = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]")
        localStorage.setItem(STORAGE_KEY, JSON.stringify([enquiry, ...existing]))
      } catch (err) {
        console.warn("[enquiry] local backup failed", err)
      }

      try {
        const res = await fetch(`/api/vendors/${encodeURIComponent(vendorSlug)}/enquire`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            vendorId,
            name: form.name,
            email: form.email,
            message: form.message,
            eventDate: form.date || null,
            guestCount: form.guestCount || null,
          }),
        })
        if (!res.ok) {
          console.warn("[enquiry] api failed", res.status)
        }
      } catch (err) {
        console.warn("[enquiry] api error", err)
      }

      setSubmitted(true)
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="py-6 text-center">
        <p className="text-[15px] font-semibold text-ink mb-1">Thanks. We&apos;ll get back to you within 24 hours.</p>
        <p className="text-[13px] text-ink-3">Your enquiry has been saved.</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-3 mb-5">
      <p className="text-[11px] font-semibold tracking-[0.18em] text-blue uppercase mb-1">Get a quote</p>
      <h2 className="text-[18px] font-semibold tracking-tight text-ink mb-1">
        Reach {vendorName.split(" ")[0]} directly
      </h2>
      <p className="text-xs text-ink-3 mb-5">Average reply: {responseTimeHours} hours.</p>

      <div>
        <label className="block text-[11px] font-medium text-ink-2 mb-1.5">Event date</label>
        <input
          type="date"
          value={form.date}
          onChange={(e) => handleChange("date", e.target.value)}
          className="w-full bg-paper border border-line rounded-xl px-3.5 py-2.5 text-[13.5px] text-ink focus:outline-none focus:border-green-500 focus:ring-4 focus:ring-green-500/10 transition"
        />
      </div>
      <div>
        <label className="block text-[11px] font-medium text-ink-2 mb-1.5">Guest count</label>
        <input
          type="number"
          placeholder="e.g. 250"
          value={form.guestCount}
          onChange={(e) => handleChange("guestCount", e.target.value)}
          className="w-full bg-paper border border-line rounded-xl px-3.5 py-2.5 text-[13.5px] text-ink placeholder:text-ink-3 focus:outline-none focus:border-green-500 focus:ring-4 focus:ring-green-500/10 transition"
        />
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
          className={`w-full bg-paper border rounded-xl px-3.5 py-2.5 text-[13.5px] text-ink placeholder:text-ink-3 focus:outline-none focus:ring-4 transition ${errors.name ? "border-rose-400 focus:border-rose-400 focus:ring-rose-100" : "border-line focus:border-green-500 focus:ring-green-500/10"}`}
        />
        {errors.name && <p className="mt-1 text-[11.5px] text-rose-600">{errors.name}</p>}
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
          className={`w-full bg-paper border rounded-xl px-3.5 py-2.5 text-[13.5px] text-ink placeholder:text-ink-3 focus:outline-none focus:ring-4 transition ${errors.email ? "border-rose-400 focus:border-rose-400 focus:ring-rose-100" : "border-line focus:border-green-500 focus:ring-green-500/10"}`}
        />
        {errors.email && <p className="mt-1 text-[11.5px] text-rose-600">{errors.email}</p>}
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
          className={`w-full bg-paper border rounded-xl px-3.5 py-2.5 text-[13.5px] text-ink placeholder:text-ink-3 focus:outline-none focus:ring-4 transition resize-none ${errors.message ? "border-rose-400 focus:border-rose-400 focus:ring-rose-100" : "border-line focus:border-green-500 focus:ring-green-500/10"}`}
        />
        {errors.message && <p className="mt-1 text-[11.5px] text-rose-600">{errors.message}</p>}
      </div>
      <button
        type="submit"
        disabled={submitting}
        className="w-full bg-green-600 text-white font-semibold py-3 rounded-xl hover:bg-green-700 active:scale-[0.99] transition shadow-sm shadow-green-600/20 text-sm disabled:opacity-60 disabled:cursor-wait"
      >
        {submitting ? "Sending..." : "Send enquiry"}
      </button>
    </form>
  )
}
