"use client"

import { useState, useTransition } from "react"
import { Check, Package, Plus, Trash2 } from "lucide-react"

import { createVendorPackage, deleteVendorPackage } from "./package-actions"

type PackageItem = {
  id: string
  name: string
  description: string | null
  price: string
  currency: string
  inclusions: string[] | null
}

export default function VendorPackagesPanel({ initial }: { initial: PackageItem[] }) {
  const [items, setItems] = useState(initial)
  const [open, setOpen] = useState(initial.length === 0)
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [price, setPrice] = useState("")
  const [inclusions, setInclusions] = useState("")
  const [message, setMessage] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function addPackage(event: React.FormEvent) {
    event.preventDefault()
    setMessage(null)
    startTransition(async () => {
      const result = await createVendorPackage({
        name,
        description: description.trim() || null,
        price,
        inclusions: inclusions.split(",").map((part) => part.trim()).filter(Boolean),
      })
      if (!result.ok) {
        setMessage(result.error)
        return
      }
      // Refreshing the route gives us the canonical row, including its id.
      window.location.reload()
    })
  }

  function removePackage(id: string) {
    if (!window.confirm("Remove this package from your profile?")) return
    startTransition(async () => {
      const result = await deleteVendorPackage(id)
      if (!result.ok) setMessage(result.error)
      else setItems((current) => current.filter((item) => item.id !== id))
    })
  }

  return (
    <section>
      <div className="flex items-end justify-between gap-4 mb-5">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.18em] text-blue uppercase mb-2">What you sell</p>
          <h2 className="text-[22px] font-bold tracking-tight text-ink">Service packages</h2>
          <p className="text-[13px] text-ink-3 mt-1">Give organizers a clear starting point before they enquire.</p>
        </div>
        <button type="button" onClick={() => setOpen((value) => !value)} className="inline-flex items-center gap-1.5 rounded-xl border border-line px-3 py-2 text-[13px] font-semibold text-ink hover:border-line-2">
          <Plus size={14} /> {open ? "Close" : "Add package"}
        </button>
      </div>

      {open && (
        <form onSubmit={addPackage} className="rounded-2xl border border-line bg-paper p-5 md:p-6 mb-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="text-[12px] font-medium text-ink-2">Package name<input required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. 100 guest catering" className="mt-1.5 w-full rounded-xl border border-line bg-paper px-3.5 py-3 text-sm" /></label>
            <label className="text-[12px] font-medium text-ink-2">Starting price (USD)<input required type="number" min="1" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="850" className="mt-1.5 w-full rounded-xl border border-line bg-paper px-3.5 py-3 text-sm" /></label>
          </div>
          <label className="block text-[12px] font-medium text-ink-2">Description<textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="What is included and who is it for?" className="mt-1.5 w-full rounded-xl border border-line bg-paper px-3.5 py-3 text-sm resize-none" /></label>
          <label className="block text-[12px] font-medium text-ink-2">Inclusions <span className="text-ink-3 font-normal">(comma separated)</span><input value={inclusions} onChange={(e) => setInclusions(e.target.value)} placeholder="Setup, staff, delivery" className="mt-1.5 w-full rounded-xl border border-line bg-paper px-3.5 py-3 text-sm" /></label>
          {message && <p className="text-[13px] text-rose-700">{message}</p>}
          <button disabled={pending} className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{pending ? "Saving…" : <><Check size={14} /> Save package</>}</button>
        </form>
      )}

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line-2 p-8 text-center"><Package size={20} className="mx-auto text-ink-3 mb-2" /><p className="text-sm font-medium text-ink">No packages yet</p><p className="text-[13px] text-ink-3 mt-1">Add one package to help organizers decide faster.</p></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {items.map((item) => (
            <div key={item.id} className="rounded-2xl border border-line bg-paper p-5">
              <div className="flex items-start justify-between gap-3"><div><h3 className="font-semibold text-ink">{item.name}</h3><p className="text-[18px] font-bold text-ink mt-2">${Number(item.price).toLocaleString()}</p></div><button type="button" onClick={() => removePackage(item.id)} aria-label={`Remove ${item.name}`} className="text-ink-3 hover:text-rose-600"><Trash2 size={15} /></button></div>
              {item.description && <p className="text-[13px] text-ink-2 mt-3 leading-relaxed">{item.description}</p>}
              {item.inclusions && item.inclusions.length > 0 && <ul className="mt-3 space-y-1">{item.inclusions.map((entry) => <li key={entry} className="text-[12px] text-ink-2 flex gap-2"><Check size={13} className="text-emerald-600 shrink-0 mt-0.5" />{entry}</li>)}</ul>}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
