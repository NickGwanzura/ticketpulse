"use client"

import { useEffect, useState, type FormEvent } from "react"
import { UserPlus, X } from "lucide-react"

type Role = "attendee" | "organizer" | "vendor" | "admin"

const ROLES: { value: Role; label: string; hint: string }[] = [
  { value: "attendee", label: "Attendee", hint: "Buys tickets and books transport." },
  { value: "organizer", label: "Organizer", hint: "Creates and manages events." },
  { value: "vendor", label: "Vendor", hint: "Sells services to organizers." },
  { value: "admin", label: "Admin", hint: "Full platform access." },
]

function validateEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

export default function InviteUserDialog() {
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState("")
  const [role, setRole] = useState<Role>("attendee")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  function reset() {
    setEmail("")
    setRole("attendee")
    setError(null)
    setSuccess(null)
    setSubmitting(false)
  }

  function close() {
    setOpen(false)
    reset()
  }

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false)
        reset()
      }
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [open])

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    const trimmed = email.trim().toLowerCase()
    if (!validateEmail(trimmed)) {
      setError("Enter a valid email address.")
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch("/api/admin/users/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed, role }),
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        setError(data.error ?? "Failed to send invite.")
        return
      }
      setSuccess(`Invite sent to ${trimmed}.`)
      setEmail("")
      setRole("attendee")
      setTimeout(() => {
        close()
      }, 1200)
    } catch {
      setError("Network error. Try again.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-xl bg-green-600 px-4 py-2.5 text-[13px] font-semibold text-white shadow-sm shadow-green-600/20 hover:bg-green-700 active:scale-[0.99] transition"
      >
        <UserPlus size={14} />
        Invite user
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Invite user"
          className="fixed inset-0 z-50 flex items-center justify-center px-4 py-8"
        >
          <div
            className="absolute inset-0 bg-ink/30 backdrop-blur-[1px]"
            onClick={close}
            aria-hidden
          />
          <div className="relative w-full max-w-md rounded-2xl border border-line bg-paper p-6 shadow-[0_24px_60px_-30px_rgba(10,37,64,0.45)]">
            <button
              type="button"
              onClick={close}
              aria-label="Close"
              className="absolute top-3 right-3 inline-flex h-7 w-7 items-center justify-center rounded-full text-ink-3 hover:text-ink hover:bg-line/40 transition-colors"
            >
              <X size={14} />
            </button>

            <p className="text-[11px] font-semibold tracking-[0.18em] text-blue uppercase mb-2">
              Invite
            </p>
            <h2 className="text-[20px] font-semibold tracking-tight text-ink mb-1">
              Invite a user by email
            </h2>
            <p className="text-[12.5px] text-ink-3 mb-5">
              We&apos;ll create the account with the chosen role and email a sign-in link.
            </p>

            <form onSubmit={handleSubmit} noValidate className="space-y-3">
              <div>
                <label className="block text-[11px] font-medium text-ink-2 mb-1.5">
                  Email <span className="text-ink-3">(required)</span>
                </label>
                <input
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value)
                    if (error) setError(null)
                  }}
                  autoFocus
                  className={`w-full bg-paper border rounded-xl px-3.5 py-2.5 text-[13.5px] text-ink placeholder:text-ink-3 focus:outline-none focus:ring-4 transition ${error ? "border-rose-400 focus:border-rose-400 focus:ring-rose-100" : "border-line focus:border-blue focus:ring-blue/10"}`}
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-ink-2 mb-1.5">Role</label>
                <div className="grid grid-cols-2 gap-2">
                  {ROLES.map((r) => {
                    const active = role === r.value
                    return (
                      <button
                        type="button"
                        key={r.value}
                        onClick={() => setRole(r.value)}
                        className={`text-left rounded-xl border px-3 py-2.5 transition ${active ? "border-blue bg-blue-soft" : "border-line bg-paper hover:bg-paper-2"}`}
                      >
                        <p className={`text-[12.5px] font-semibold tracking-tight ${active ? "text-navy" : "text-ink"}`}>
                          {r.label}
                        </p>
                        <p className="text-[11px] text-ink-3 mt-0.5 line-clamp-1">{r.hint}</p>
                      </button>
                    )
                  })}
                </div>
              </div>

              {error && (
                <p className="text-[12px] text-rose-600" role="alert">
                  {error}
                </p>
              )}
              {success && (
                <p className="text-[12px] text-green-700" role="status">
                  {success}
                </p>
              )}

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={close}
                  disabled={submitting}
                  className="text-[13px] font-semibold text-ink-2 hover:text-ink px-3 py-2 rounded-lg disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-2 rounded-xl bg-green-600 px-4 py-2.5 text-[13px] font-semibold text-white shadow-sm shadow-green-600/20 hover:bg-green-700 active:scale-[0.99] transition disabled:opacity-60 disabled:cursor-wait"
                >
                  {submitting ? "Sending..." : "Send invite"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
