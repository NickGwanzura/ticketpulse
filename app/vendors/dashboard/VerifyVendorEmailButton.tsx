"use client"

import { useState, useTransition } from "react"
import { requestVendorEmailVerification } from "./verify-email-action"

export default function VerifyVendorEmailButton() {
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState("")
  return (
    <div className="mt-3">
      <button type="button" disabled={pending} onClick={() => startTransition(async () => {
        const result = await requestVendorEmailVerification()
        setMessage(result.message)
      })} className="rounded-lg bg-amber-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60">
        {pending ? "Sending…" : "Send verification email"}
      </button>
      {message && <p role="status" className="mt-2 text-xs text-ink-2">{message}</p>}
    </div>
  )
}
