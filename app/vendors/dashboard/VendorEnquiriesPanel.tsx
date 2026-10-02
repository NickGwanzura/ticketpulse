"use client"

import { useState, useTransition } from "react"
import { CalendarDays, Mail, MessageCircle } from "lucide-react"

import { updateVendorEnquiryStatus } from "./enquiry-actions"

type Enquiry = {
  id: string
  name: string
  email: string
  phone: string | null
  eventDate: string | null
  guestCount: string | null
  message: string
  status: string
  createdAt: Date | string
}

const STATUSES = ["new", "contacted", "quoted", "accepted", "declined", "closed"] as const

export default function VendorEnquiriesPanel({ initial }: { initial: Enquiry[] }) {
  const [items, setItems] = useState(initial)
  const [pending, startTransition] = useTransition()

  function update(id: string, status: string) {
    startTransition(async () => {
      const result = await updateVendorEnquiryStatus(id, status)
      if (result.ok) setItems((current) => current.map((item) => item.id === id ? { ...item, status } : item))
    })
  }

  return (
    <section>
      <div className="flex items-end justify-between gap-4 mb-5"><div><p className="text-[11px] font-semibold tracking-[0.18em] text-blue uppercase mb-2">Demand</p><h2 className="text-[22px] font-bold tracking-tight text-ink">Enquiries</h2><p className="text-[13px] text-ink-3 mt-1">Reply promptly and keep each opportunity moving.</p></div><span className="rounded-full bg-brand-50 px-3 py-1.5 text-[12px] font-semibold text-blue">{items.filter((item) => item.status === "new").length} new</span></div>
      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line-2 p-8 text-center"><MessageCircle size={20} className="mx-auto text-ink-3 mb-2" /><p className="text-sm font-medium text-ink">No enquiries yet</p><p className="text-[13px] text-ink-3 mt-1">When an organizer asks for a quote, it will appear here.</p></div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <article key={item.id} className="rounded-2xl border border-line bg-paper p-5">
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-ink">{item.name}</h3><span className="rounded-full bg-paper-2 px-2 py-0.5 text-[11px] font-medium text-ink-2">{item.status}</span></div><div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[12px] text-ink-3"><span className="inline-flex items-center gap-1"><Mail size={12} />{item.email}</span>{item.eventDate && <span className="inline-flex items-center gap-1"><CalendarDays size={12} />{item.eventDate}</span>}{item.guestCount && <span>{item.guestCount} guests</span>}</div></div>
                <select value={item.status} disabled={pending} onChange={(e) => update(item.id, e.target.value)} aria-label={`Status for enquiry from ${item.name}`} className="shrink-0 rounded-lg border border-line bg-paper px-2.5 py-2 text-[12px] font-medium text-ink"><option value="new">New</option>{STATUSES.filter((status) => status !== "new").map((status) => <option key={status} value={status}>{status[0].toUpperCase() + status.slice(1)}</option>)}</select>
              </div>
              <p className="text-[13px] leading-relaxed text-ink-2 mt-4 whitespace-pre-wrap">{item.message}</p>
              <a href={`mailto:${item.email}`} className="inline-flex items-center gap-1.5 mt-4 text-[12px] font-semibold text-blue hover:underline">Reply by email <Mail size={12} /></a>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
