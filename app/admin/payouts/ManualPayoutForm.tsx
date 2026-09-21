"use client"

import { useActionState, useMemo, useState, useEffect } from "react"
import { Banknote } from "lucide-react"
import { recordManualPayoutAction } from "./actions"
import { useToast } from "@/components/ui/Toast"

type OrganizerOption = {
  id: string
  name: string | null
  email: string | null
}

type EventOption = {
  id: string
  title: string
  organizerId: string
}

type FormState = {
  error: string | null
  success: string | null
}

export default function ManualPayoutForm({
  organizers,
  events,
}: {
  organizers: OrganizerOption[]
  events: EventOption[]
}) {
  const [selectedOrganizer, setSelectedOrganizer] = useState("")
  const filteredEvents = useMemo(
    () => events.filter((event) => event.organizerId === selectedOrganizer),
    [events, selectedOrganizer],
  )

  const { toast } = useToast()

  const [state, formAction, pending] = useActionState<FormState, FormData>(
    async (_prev, formData) => {
      try {
        const result = await recordManualPayoutAction(formData)
        return result.ok
          ? { success: result.message, error: null }
          : { success: null, error: result.message }
      } catch (err) {
        return {
          success: null,
          error: err instanceof Error ? err.message : "The manual payout could not be recorded.",
        }
      }
    },
    { error: null, success: null },
  )

  useEffect(() => {
    if (state.success) toast({ title: "Payout recorded", description: state.success, variant: "success" })
    if (state.error) toast({ title: "Could not record payout", description: state.error, variant: "error" })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.success, state.error])

  return (
    <form action={formAction} className="space-y-3">
      <div className="grid gap-3 md:grid-cols-2">
        <label className="space-y-1.5 text-[12px] font-semibold text-ink-2">
          Organiser
          <select
            name="userId"
            required
            value={selectedOrganizer}
            onChange={(event) => setSelectedOrganizer(event.target.value)}
            className="w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-[14px] font-medium text-ink outline-none focus:border-navy"
          >
            <option value="" disabled>Select organiser...</option>
            {organizers.map((organizer) => (
              <option key={organizer.id} value={organizer.id}>
                {organizer.name ?? organizer.email ?? organizer.id}
                {organizer.email && organizer.name ? ` (${organizer.email})` : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1.5 text-[12px] font-semibold text-ink-2">
          Event (optional)
          <select
            name="eventId"
            defaultValue=""
            disabled={!selectedOrganizer}
            className="w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-[14px] font-medium text-ink outline-none focus:border-navy disabled:cursor-not-allowed disabled:opacity-60"
          >
            <option value="">Not tied to one event</option>
            {filteredEvents.map((event) => (
              <option key={event.id} value={event.id}>{event.title}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <label className="space-y-1.5 text-[12px] font-semibold text-ink-2">
          Amount
          <input name="amount" type="number" min="0.01" step="0.01" required placeholder="0.00" className="w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-[14px] font-medium text-ink outline-none focus:border-navy" />
        </label>
        <label className="space-y-1.5 text-[12px] font-semibold text-ink-2">
          Method
          <select name="method" required defaultValue="cash" className="w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-[14px] font-medium text-ink outline-none focus:border-navy">
            <option value="cash">Cash</option>
            <option value="ecocash">EcoCash</option>
            <option value="bank_usd">Bank transfer</option>
          </select>
        </label>
        <label className="space-y-1.5 text-[12px] font-semibold text-ink-2">
          Date paid
          <input name="paidDate" type="date" required className="w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-[14px] font-medium text-ink outline-none focus:border-navy" />
        </label>
        <label className="space-y-1.5 text-[12px] font-semibold text-ink-2">
          Reference
          <input name="proofReference" required placeholder="Receipt / transfer ref" className="w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-[14px] font-medium text-ink outline-none focus:border-navy" />
        </label>
      </div>

      <div className="grid gap-3 md:grid-cols-[1.6fr_auto] md:items-end">
        <label className="space-y-1.5 text-[12px] font-semibold text-ink-2">
          Notes (optional)
          <input name="notes" maxLength={500} placeholder="e.g. Paid at the office after The Sunday Table" className="w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-[14px] font-medium text-ink outline-none focus:border-navy" />
        </label>
      </div>

      <label className="flex items-start gap-2 text-[12px] text-ink-2">
        <input name="confirmOverage" type="checkbox" value="true" className="mt-0.5" />
        <span>
          Record this even if it's more than the event's available balance right now.
          Leave unchecked unless you've already checked reconciliation — this is how
          duplicate/phantom settlement payouts have happened before.
        </span>
      </label>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-navy px-5 py-3 text-[13px] font-semibold text-white transition hover:bg-navy-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? (
            <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
          ) : (
            <Banknote size={14} />
          )}
          {pending ? "Recording..." : "Record payout"}
        </button>
      </div>
    </form>
  )
}
