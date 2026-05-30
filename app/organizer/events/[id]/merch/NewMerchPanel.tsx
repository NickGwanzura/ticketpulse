"use client"

import { useState } from "react"
import { Plus, X } from "lucide-react"

import MerchForm from "./MerchForm"

export default function NewMerchPanel({ eventId }: { eventId: string }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="rounded-2xl border border-dashed border-line bg-paper-2/40 p-5 md:p-6">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <p className="text-[14.5px] font-semibold text-ink">New merch item</p>
          <p className="text-[12.5px] text-ink-2 mt-0.5">T-shirts, caps, posters: sell merch alongside tickets.</p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3.5 py-2 text-[12.5px] font-semibold text-white hover:bg-brand-700 transition"
        >
          {open ? <><X size={13} /> Close</> : <><Plus size={13} /> Add merch</>}
        </button>
      </div>
      {open && (
        <div className="rounded-xl border border-line bg-paper p-5 mt-3">
          <MerchForm eventId={eventId} onDone={() => setOpen(false)} />
        </div>
      )}
    </div>
  )
}
