"use client"

import { useFormStatus } from "react-dom"
import { Rocket } from "lucide-react"

export default function PublishEventButton() {
  const { pending } = useFormStatus()

  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-brand-600/20 transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-70"
    >
      <Rocket size={14} />
      {pending ? "Submitting..." : "Submit for review"}
    </button>
  )
}
