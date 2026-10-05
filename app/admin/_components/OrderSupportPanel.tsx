"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Pencil, StickyNote } from "lucide-react"

import {
  addOrderNoteAction,
  updateOrderContactAction,
  type SupportResult,
} from "@/app/admin/actions/support"

export type SupportNote = { id: string; text: string; by: string; at: string }

const inputClass =
  "w-full rounded-lg border border-line bg-paper px-3 py-2 text-[13px] text-ink focus:outline-none focus:border-line-2 focus:ring-4 focus:ring-brand-500/10"

export default function OrderSupportPanel({
  orderId,
  contact,
  notes,
}: {
  orderId: string
  contact: { name: string; email: string; phone: string }
  notes: SupportNote[]
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState(contact)
  const [note, setNote] = useState("")
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null)

  function run(action: () => Promise<SupportResult>, okText: string, onOk: () => void) {
    setMessage(null)
    startTransition(async () => {
      const result = await action()
      if (result.ok) {
        setMessage({ tone: "ok", text: okText })
        onOk()
        router.refresh()
      } else {
        setMessage({ tone: "error", text: result.error ?? "Something went wrong" })
      }
    })
  }

  return (
    <div className="rounded-2xl border border-line bg-paper overflow-hidden">
      <div className="px-5 md:px-6 py-4 border-b border-line flex items-center justify-between">
        <h3 className="text-[15px] font-semibold tracking-tight text-ink flex items-center gap-2">
          <StickyNote size={15} className="text-ink-3" /> Support
        </h3>
        {!editing && (
          <button
            type="button"
            onClick={() => { setForm(contact); setEditing(true); setMessage(null) }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-[12px] font-medium text-ink-2 hover:text-ink hover:bg-paper-2"
          >
            <Pencil size={12} /> Edit buyer details
          </button>
        )}
      </div>

      <div className="p-5 md:p-6 space-y-6">
        {message && (
          <p className={`rounded-lg px-3 py-2 text-[12px] ${message.tone === "ok" ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-800"}`}>
            {message.text}
          </p>
        )}

        {editing && (
          <form
            className="grid gap-3 md:grid-cols-3"
            onSubmit={(e) => {
              e.preventDefault()
              run(() => updateOrderContactAction(orderId, form), "Buyer details updated. Use Resend tickets to send them to the new address.", () => setEditing(false))
            }}
          >
            <label className="text-[12px] text-ink-3">
              Name
              <input className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </label>
            <label className="text-[12px] text-ink-3">
              Email
              <input type="email" required className={inputClass} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </label>
            <label className="text-[12px] text-ink-3">
              Phone (WhatsApp)
              <input className={inputClass} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </label>
            <div className="md:col-span-3 flex gap-2">
              <button type="submit" disabled={pending} className="rounded-lg bg-brand-600 px-4 py-2 text-[13px] font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
                {pending ? "Saving…" : "Save details"}
              </button>
              <button type="button" onClick={() => setEditing(false)} className="rounded-lg border border-line px-4 py-2 text-[13px] font-medium text-ink-2 hover:bg-paper-2">
                Cancel
              </button>
            </div>
          </form>
        )}

        <div>
          <p className="text-[12px] font-semibold uppercase tracking-widest text-ink-3 mb-2">Internal notes</p>
          {notes.length === 0 ? (
            <p className="text-[13px] text-ink-3">No notes yet. Notes are only visible to staff.</p>
          ) : (
            <ul className="space-y-2">
              {notes.map((n) => (
                <li key={n.id} className="rounded-xl bg-paper-2 px-3.5 py-2.5">
                  <p className="text-[13px] text-ink whitespace-pre-wrap">{n.text}</p>
                  <p className="mt-1 text-[11px] text-ink-3">{n.by} · {new Date(n.at).toLocaleString()}</p>
                </li>
              ))}
            </ul>
          )}
          <form
            className="mt-3 flex flex-col gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              run(() => addOrderNoteAction(orderId, note), "Note added.", () => setNote(""))
            }}
          >
            <textarea
              className={inputClass}
              rows={2}
              maxLength={2000}
              placeholder="e.g. Refunded by phone, customer will call back Monday"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <button type="submit" disabled={pending || !note.trim()} className="self-start rounded-lg border border-line px-4 py-2 text-[13px] font-semibold text-ink hover:bg-paper-2 disabled:opacity-60">
              Add note
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
