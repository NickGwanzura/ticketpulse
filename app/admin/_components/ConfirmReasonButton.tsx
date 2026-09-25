"use client"

import { useState } from "react"
import { useFormStatus } from "react-dom"

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="min-h-9 rounded-md bg-rose-600 px-3 text-[12px] font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
    >
      {pending ? "Saving…" : label}
    </button>
  )
}

/**
 * A consequential admin action (reject, freeze) behind a confirm step that
 * requires a reason, which the action records in the admin audit log.
 */
export default function ConfirmReasonButton({
  action,
  label,
  confirmLabel,
  prompt,
  buttonClassName,
  icon,
}: {
  action: (formData: FormData) => void | Promise<void>
  label: string
  confirmLabel: string
  prompt: string
  buttonClassName: string
  icon?: React.ReactNode
}) {
  const [open, setOpen] = useState(false)

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={buttonClassName}>
        {icon}
        {label}
      </button>
    )
  }

  return (
    <form action={action} className="flex flex-wrap items-center gap-1.5">
      <label className="sr-only" htmlFor={`reason-${label}`}>{prompt}</label>
      <input
        id={`reason-${label}`}
        name="reason"
        required
        minLength={5}
        autoFocus
        placeholder={prompt}
        className="min-h-9 w-48 rounded-md border border-line bg-paper px-2 text-[12px] text-ink placeholder:text-ink-3/70"
      />
      <Submit label={confirmLabel} />
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="min-h-9 rounded-md border border-line px-3 text-[12px] text-ink-2 hover:bg-paper-2"
      >
        Cancel
      </button>
    </form>
  )
}
