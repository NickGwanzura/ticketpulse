"use client"

import { useActionState } from "react"
import { Plus } from "lucide-react"
import { generateStaffTicketAction, type StaffTicketState } from "./actions"

const STAFF_ROLES = [
  { value: "security", label: "Security" },
  { value: "usher", label: "Usher" },
  { value: "dj_sound", label: "DJ / Sound" },
  { value: "bar_staff", label: "Bar Staff" },
  { value: "vip_host", label: "VIP Host" },
  { value: "media", label: "Media Team" },
  { value: "other", label: "Other" },
] as const

export default function GenerateStaffTicketForm({ eventId }: { eventId: string }) {
  const [state, formAction, pending] = useActionState<StaffTicketState, FormData>(
    generateStaffTicketAction,
    { ok: false },
  )

  return (
    <div className="rounded-2xl border border-dashed border-line bg-paper-2/40 p-5">
      <p className="text-[15px] font-semibold text-ink mb-3">Generate staff ticket</p>

      <form action={formAction} className="space-y-4">
        <input type="hidden" name="eventId" value={eventId} />

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-[13px] font-medium text-ink mb-1">Staff name *</label>
            <input
              name="staffName"
              type="text"
              required
              placeholder="e.g. John Doe"
              className="w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-[14px] text-ink placeholder:text-ink-3 focus:outline-none focus:ring-4 focus:border-line-2 focus:ring-brand-500/15"
            />
            {state.fieldErrors?.staffName && (
              <p className="mt-1 text-[12px] text-rose-600">{state.fieldErrors.staffName}</p>
            )}
          </div>

          <div>
            <label className="block text-[13px] font-medium text-ink mb-1">Role *</label>
            <select
              name="staffRole"
              required
              defaultValue=""
              className="w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-[14px] text-ink focus:outline-none focus:ring-4 focus:border-line-2 focus:ring-brand-500/15"
            >
              <option value="" disabled>Select role</option>
              {STAFF_ROLES.map((role) => (
                <option key={role.value} value={role.value}>{role.label}</option>
              ))}
            </select>
            {state.fieldErrors?.staffRole && (
              <p className="mt-1 text-[12px] text-rose-600">{state.fieldErrors.staffRole}</p>
            )}
          </div>

          <div>
            <label className="block text-[13px] font-medium text-ink mb-1">Phone *</label>
            <input
              name="staffPhone"
              type="tel"
              required
              placeholder="e.g. +263 77 123 4567"
              className="w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-[14px] text-ink placeholder:text-ink-3 focus:outline-none focus:ring-4 focus:border-line-2 focus:ring-brand-500/15"
            />
            {state.fieldErrors?.staffPhone && (
              <p className="mt-1 text-[12px] text-rose-600">{state.fieldErrors.staffPhone}</p>
            )}
          </div>
        </div>

        {state.error && (
          <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-[13px] text-red-700">
            {state.error}
          </div>
        )}

        {state.ok && state.message && (
          <div className="rounded-xl bg-green-50 border border-brand-200 px-4 py-3 text-[13px] text-green-800">
            {state.message}
          </div>
        )}

        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-[13px] font-semibold text-white shadow-sm shadow-brand-600/20 hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          <Plus size={14} />
          {pending ? "Generating..." : "Generate ticket"}
        </button>
      </form>
    </div>
  )
}
