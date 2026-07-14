"use client"

import { useState } from "react"
import { useFormStatus } from "react-dom"
import { Undo2, X } from "lucide-react"

function SubmitButton({ compact }: { compact?: boolean }) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className={compact
        ? "inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-rose-600 text-white hover:bg-rose-700 transition-colors disabled:opacity-60"
        : "inline-flex h-8 items-center gap-1 px-2.5 rounded-md bg-rose-600 text-white text-[12px] font-semibold hover:bg-rose-700 transition-colors disabled:opacity-60"}
    >
      {pending ? "Rejecting…" : "Confirm"}
    </button>
  )
}

export default function RejectEventButton({
  eventId,
  action,
  compact,
}: {
  eventId: string
  action: (eventId: string, formData: FormData) => void | Promise<void>
  compact?: boolean
}) {
  const [open, setOpen] = useState(false)

  if (!open) {
    return compact ? (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-rose-50 text-rose-700 hover:bg-rose-100 transition-colors"
      >
        <Undo2 size={12} /> Reject
      </button>
    ) : (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Reject"
        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-rose-600 hover:text-rose-800 hover:bg-rose-50 transition-colors"
      >
        <Undo2 size={14} />
      </button>
    )
  }

  return (
    <form
      action={action.bind(null, eventId)}
      onSubmit={() => setOpen(false)}
      className="flex items-center gap-1.5"
    >
      <input
        type="text"
        name="reason"
        placeholder="Reason (optional)"
        autoFocus
        className="w-40 rounded-md border border-line bg-paper px-2 py-1.5 text-[12px] text-ink placeholder:text-ink-3 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
      />
      <SubmitButton compact={compact} />
      <button
        type="button"
        onClick={() => setOpen(false)}
        aria-label="Cancel"
        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-ink-3 hover:text-ink hover:bg-paper-2 transition-colors"
      >
        <X size={14} />
      </button>
    </form>
  )
}
