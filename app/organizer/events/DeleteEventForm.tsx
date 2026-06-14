"use client"

import { useFormStatus } from "react-dom"
import { Trash2 } from "lucide-react"

import { deleteOrganizerEventAction } from "./actions"

type Props = {
  eventId: string
  eventTitle: string
  compact?: boolean
  iconOnly?: boolean
}

function DeleteButton({ compact, iconOnly }: Pick<Props, "compact" | "iconOnly">) {
  const { pending } = useFormStatus()

  if (iconOnly) {
    return (
      <button
        type="submit"
        aria-label="Delete event"
        disabled={pending}
        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-rose-600 hover:bg-rose-50 disabled:opacity-50 disabled:cursor-wait transition-colors"
      >
        <Trash2 size={14} />
      </button>
    )
  }

  return (
    <button
      type="submit"
      disabled={pending}
      className={[
        "inline-flex items-center justify-center gap-1.5 rounded-xl font-semibold text-white shadow-sm shadow-rose-600/20 hover:bg-rose-700 disabled:opacity-50 disabled:cursor-wait transition-colors",
        compact ? "px-3 py-2 text-[12px] bg-rose-600" : "px-4 py-2.5 text-[13px] bg-rose-600",
      ].join(" ")}
    >
      <Trash2 size={compact ? 13 : 14} />
      {pending ? "Deleting..." : "Delete event"}
    </button>
  )
}

export default function DeleteEventForm({ eventId, eventTitle, compact, iconOnly }: Props) {
  return (
    <form
      action={deleteOrganizerEventAction}
      onSubmit={(event) => {
        const confirmed = window.confirm(
          `Delete "${eventTitle}"? This only works for events with no orders, tickets, or payment records.`,
        )
        if (!confirmed) event.preventDefault()
      }}
    >
      <input type="hidden" name="id" value={eventId} />
      <DeleteButton compact={compact} iconOnly={iconOnly} />
    </form>
  )
}
