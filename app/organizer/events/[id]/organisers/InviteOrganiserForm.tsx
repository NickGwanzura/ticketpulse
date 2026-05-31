"use client"

import { useActionState, useState } from "react"
import { Send, UserPlus } from "lucide-react"
import { inviteOrganiserAction, type InviteOrganiserState } from "./actions"

export default function InviteOrganiserForm({ eventId }: { eventId: string }) {
  const [state, formAction, pending] = useActionState<InviteOrganiserState, FormData>(
    inviteOrganiserAction,
    { ok: false },
  )

  return (
    <div className="rounded-2xl border border-dashed border-line bg-paper-2/40 p-5">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <p className="text-[15px] font-semibold text-ink">Invite an organiser</p>
          <p className="text-[13px] text-ink-2 mt-0.5">
            Send an email invitation to someone you trust to help manage this event.
          </p>
        </div>
      </div>

      <form action={formAction} className="space-y-3">
        <input type="hidden" name="eventId" value={eventId} />

        <div>
          <label htmlFor="email" className="block text-[13px] font-medium text-ink mb-1.5">
            Email address
          </label>
          <div className="flex items-stretch gap-2">
            <input
              id="email"
              name="email"
              type="email"
              required
              placeholder="colleague@example.com"
              className="flex-1 rounded-xl border border-line bg-paper px-4 py-2.5 text-[14px] text-ink placeholder:text-ink-3 focus:outline-none focus:ring-4 focus:border-line-2 focus:ring-brand-500/15"
            />
            <button
              type="submit"
              disabled={pending}
              className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-[13px] font-semibold text-white shadow-sm shadow-brand-600/20 hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition shrink-0"
            >
              <Send size={14} />
              {pending ? "Sending..." : "Send invite"}
            </button>
          </div>
          {state.fieldErrors?.email && (
            <p className="mt-1 text-[12px] text-rose-600">{state.fieldErrors.email}</p>
          )}
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
      </form>
    </div>
  )
}
