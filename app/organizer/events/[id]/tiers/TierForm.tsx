"use client"

import { useActionState } from "react"
import { useFormStatus } from "react-dom"
import { Save } from "lucide-react"

import Button from "@/components/ui/Button"
import { saveTierAction, type TierFormState } from "./actions"

const INITIAL: TierFormState = { ok: true }

function inputCls(hasError?: boolean) {
  return [
    "w-full rounded-xl border bg-paper px-3 py-2.5 text-[14px] text-ink",
    "placeholder:text-ink-3 focus:outline-none focus:ring-4",
    hasError
      ? "border-rose-300 focus:border-rose-400 focus:ring-rose-500/15"
      : "border-line focus:border-line-2 focus:ring-brand-500/15",
  ].join(" ")
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return <p className="mt-1 text-[12px] text-rose-600">{message}</p>
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" loading={pending} size="md">
      <Save size={14} /> {pending ? "Saving…" : label}
    </Button>
  )
}

type Props = {
  eventId: string
  tier?: {
    id: string
    name: string
    description: string | null
    price: string
    currency: string | null
    totalQuantity: number
    maxPerOrder: number | null
    salesStart: Date | null
    salesEnd: Date | null
    earlyBirdPrice: string | null
    earlyBirdUntil: Date | null
    earlyBirdQuantity: number | null
  }
  onDone?: () => void
}

function toLocalInputValue(d: Date | null): string {
  if (!d) return ""
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function TierForm({ eventId, tier, onDone }: Props) {
  const [state, formAction] = useActionState(saveTierAction, INITIAL)
  const errs = state.fieldErrors ?? {}

  if (state.ok && state.message && onDone) {
    setTimeout(onDone, 0)
  }

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="eventId" value={eventId} />
      {tier && <input type="hidden" name="tierId" value={tier.id} />}

      {state.error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] text-rose-700">
          {state.error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="md:col-span-2">
          <label htmlFor="name" className="block text-[13px] font-medium text-ink mb-1.5">Tier name</label>
          <input id="name" name="name" type="text" required maxLength={160} defaultValue={tier?.name ?? ""} placeholder="General admission" className={inputCls(!!errs.name)} />
          <FieldError message={errs.name} />
        </div>

        <div className="md:col-span-2">
          <label htmlFor="description" className="block text-[13px] font-medium text-ink mb-1.5">Description <span className="text-ink-3 font-normal">(optional)</span></label>
          <textarea id="description" name="description" rows={2} maxLength={2000} defaultValue={tier?.description ?? ""} placeholder="What this ticket includes" className={inputCls()} />
        </div>

        <div>
          <label htmlFor="price" className="block text-[13px] font-medium text-ink mb-1.5">Price</label>
          <input id="price" name="price" type="number" min="0" step="0.01" required defaultValue={tier?.price ?? ""} placeholder="20.00" className={inputCls(!!errs.price)} />
          <FieldError message={errs.price} />
        </div>

        <div>
          <label htmlFor="currency" className="block text-[13px] font-medium text-ink mb-1.5">Currency</label>
          <select id="currency" name="currency" defaultValue={tier?.currency ?? "USD"} className={inputCls()}>
            <option value="USD">USD</option>
            <option value="ZWL">ZWL</option>
            <option value="ZAR">ZAR</option>
            <option value="GBP">GBP</option>
          </select>
        </div>

        <div>
          <label htmlFor="totalQuantity" className="block text-[13px] font-medium text-ink mb-1.5">Capacity</label>
          <input id="totalQuantity" name="totalQuantity" type="number" min="1" step="1" required defaultValue={tier?.totalQuantity ?? ""} placeholder="100" className={inputCls(!!errs.totalQuantity)} />
          <FieldError message={errs.totalQuantity} />
        </div>

        <div>
          <label htmlFor="maxPerOrder" className="block text-[13px] font-medium text-ink mb-1.5">Max per order</label>
          <input id="maxPerOrder" name="maxPerOrder" type="number" min="1" step="1" defaultValue={tier?.maxPerOrder ?? 10} className={inputCls(!!errs.maxPerOrder)} />
          <FieldError message={errs.maxPerOrder} />
        </div>

        <div>
          <label htmlFor="salesStart" className="block text-[13px] font-medium text-ink mb-1.5">Sales start <span className="text-ink-3 font-normal">(optional)</span></label>
          <input id="salesStart" name="salesStart" type="datetime-local" defaultValue={toLocalInputValue(tier?.salesStart ?? null)} className={inputCls()} />
          <p className="mt-1 text-[12px] text-ink-3">Leave blank to start selling immediately.</p>
        </div>

        <div>
          <label htmlFor="salesEnd" className="block text-[13px] font-medium text-ink mb-1.5">Sales end <span className="text-ink-3 font-normal">(optional)</span></label>
          <input id="salesEnd" name="salesEnd" type="datetime-local" defaultValue={toLocalInputValue(tier?.salesEnd ?? null)} className={inputCls(!!errs.salesEnd)} />
          <FieldError message={errs.salesEnd} />
        </div>
      </div>

      {/* Early bird pricing */}
      <div className="rounded-xl border border-line bg-paper-2 p-4 space-y-4">
        <div>
          <p className="text-[13px] font-semibold text-ink mb-0.5">Early bird pricing <span className="text-ink-3 font-normal">(optional)</span></p>
          <p className="text-[12px] text-ink-3">Offer a lower price that auto-switches to the regular price after a date or quantity.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label htmlFor="earlyBirdPrice" className="block text-[13px] font-medium text-ink mb-1.5">Early bird price</label>
            <input id="earlyBirdPrice" name="earlyBirdPrice" type="number" min="0" step="0.01" defaultValue={tier?.earlyBirdPrice ?? ""} placeholder="15.00" className={inputCls()} />
          </div>
          <div>
            <label htmlFor="earlyBirdUntil" className="block text-[13px] font-medium text-ink mb-1.5">Available until</label>
            <input id="earlyBirdUntil" name="earlyBirdUntil" type="datetime-local" defaultValue={toLocalInputValue(tier?.earlyBirdUntil ?? null)} className={inputCls()} />
          </div>
          <div>
            <label htmlFor="earlyBirdQuantity" className="block text-[13px] font-medium text-ink mb-1.5">Max qty at early price</label>
            <input id="earlyBirdQuantity" name="earlyBirdQuantity" type="number" min="1" step="1" defaultValue={tier?.earlyBirdQuantity ?? ""} placeholder="50" className={inputCls()} />
            <p className="mt-1 text-[12px] text-ink-3">Switches to regular price after this many sold.</p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end pt-2">
        <SubmitButton label={tier ? "Save changes" : "Add tier"} />
      </div>
    </form>
  )
}
