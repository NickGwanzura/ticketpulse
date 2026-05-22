"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Lock, ArrowRight } from "lucide-react"

export default function ResetForm({ token }: { token: string }) {
  const router = useRouter()
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (submitting) return
    setError(null)

    if (password.length < 8) {
      setError("Password must be at least 8 characters.")
      return
    }
    if (password !== confirm) {
      setError("Passwords don't match.")
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      })
      if (!res.ok) {
        setError("Invalid or expired link.")
        setSubmitting(false)
        return
      }
      router.push("/auth/signin?reset=ok")
    } catch {
      setError("Something went wrong. Try again.")
      setSubmitting(false)
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-2xl border border-line bg-paper p-6 shadow-sm shadow-ink/[0.03] space-y-4"
    >
      <div>
        <label className="block text-[11.5px] font-medium text-ink-2 mb-1.5">New password</label>
        <div className="relative">
          <Lock size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-3" />
          <input
            type="password"
            name="password"
            required
            minLength={8}
            autoComplete="new-password"
            placeholder="At least 8 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-paper border border-line rounded-xl pl-10 pr-4 py-3 text-sm text-ink placeholder:text-ink-3 focus:outline-none focus:border-green-500 focus:ring-4 focus:ring-green-500/10 transition"
          />
        </div>
      </div>
      <div>
        <label className="block text-[11.5px] font-medium text-ink-2 mb-1.5">Confirm new password</label>
        <div className="relative">
          <Lock size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-3" />
          <input
            type="password"
            name="confirm"
            required
            minLength={8}
            autoComplete="new-password"
            placeholder="Repeat your password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="w-full bg-paper border border-line rounded-xl pl-10 pr-4 py-3 text-sm text-ink placeholder:text-ink-3 focus:outline-none focus:border-green-500 focus:ring-4 focus:ring-green-500/10 transition"
          />
        </div>
      </div>

      {error ? (
        <p className="text-[12.5px] font-medium text-rose-600">{error}</p>
      ) : null}

      <button
        type="submit"
        disabled={submitting}
        className="w-full inline-flex items-center justify-center gap-2 bg-green-600 text-white font-semibold text-sm py-3 rounded-xl hover:bg-green-700 active:scale-[0.99] transition shadow-sm shadow-green-600/20 disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {submitting ? "Updating..." : (<>Update password <ArrowRight size={14} /></>)}
      </button>
    </form>
  )
}
