"use client"

import { useState } from "react"
import { Plus, X } from "lucide-react"

import GalleryForm from "./GalleryForm"

export default function NewGalleryPanel({ eventId }: { eventId: string }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="rounded-2xl border border-dashed border-line bg-paper-2/40 p-5 md:p-6">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <p className="text-[14.5px] font-semibold text-ink">New gallery</p>
          <p className="text-[12.5px] text-ink-2 mt-0.5">Group photos into a pack: Saturday night, backstage, after-party.</p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-navy px-3.5 py-2 text-[12.5px] font-semibold text-white hover:bg-navy-700 transition"
        >
          {open ? <><X size={13} /> Close</> : <><Plus size={13} /> Create gallery</>}
        </button>
      </div>
      {open && (
        <div className="rounded-xl border border-line bg-paper p-5 mt-3">
          <GalleryForm eventId={eventId} onDone={() => setOpen(false)} />
        </div>
      )}
    </div>
  )
}
