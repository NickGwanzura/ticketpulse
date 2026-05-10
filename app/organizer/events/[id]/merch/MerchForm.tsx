"use client"

import { useActionState, useState } from "react"
import { useFormStatus } from "react-dom"
import { Save } from "lucide-react"

import Button from "@/components/ui/Button"
import ImageUploader from "@/components/ui/ImageUploader"
import { saveMerchAction, type MerchFormState } from "./actions"

const INITIAL: MerchFormState = { ok: true }

function inputCls(hasError?: boolean) {
  return [
    "w-full rounded-xl border bg-paper px-3 py-2.5 text-[14px] text-ink",
    "placeholder:text-ink-3 focus:outline-none focus:ring-4",
    hasError
      ? "border-rose-300 focus:border-rose-400 focus:ring-rose-500/15"
      : "border-line focus:border-line-2 focus:ring-blue/15",
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
  merch?: {
    id: string
    name: string
    description: string | null
    price: string
    currency: string | null
    images: string[] | null
    sizes: string[] | null
    colors: string[] | null
    stockQuantity: number | null
    active: boolean | null
    deliveryAvailable: boolean | null
    pickupAtEvent: boolean | null
  }
  onDone?: () => void
}

export default function MerchForm({ eventId, merch, onDone }: Props) {
  const [state, formAction] = useActionState(saveMerchAction, INITIAL)
  const [images, setImages] = useState<string[]>(merch?.images ?? [])
  const errs = state.fieldErrors ?? {}

  if (state.ok && state.message && onDone) {
    setTimeout(onDone, 0)
  }

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="eventId" value={eventId} />
      {merch && <input type="hidden" name="merchId" value={merch.id} />}
      <input type="hidden" name="images" value={JSON.stringify(images)} />

      {state.error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] text-rose-700">
          {state.error}
        </div>
      )}

      <ImageUploader
        kind="merch"
        eventId={eventId}
        multiple
        values={images}
        onValuesChange={(next) => setImages(next)}
        maxItems={8}
        aspectRatio="square"
        label="Product images"
        helperText="The first image is the primary. Drag to reorder."
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="md:col-span-2">
          <label htmlFor="name" className="block text-[13px] font-medium text-ink mb-1.5">Name</label>
          <input id="name" name="name" type="text" required maxLength={160} defaultValue={merch?.name ?? ""} placeholder="Tour t-shirt" className={inputCls(!!errs.name)} />
          <FieldError message={errs.name} />
        </div>

        <div className="md:col-span-2">
          <label htmlFor="description" className="block text-[13px] font-medium text-ink mb-1.5">Description</label>
          <textarea id="description" name="description" rows={3} maxLength={2000} defaultValue={merch?.description ?? ""} className={inputCls()} />
        </div>

        <div>
          <label htmlFor="price" className="block text-[13px] font-medium text-ink mb-1.5">Price</label>
          <input id="price" name="price" type="number" min="0" step="0.01" required defaultValue={merch?.price ?? ""} className={inputCls(!!errs.price)} />
          <FieldError message={errs.price} />
        </div>

        <div>
          <label htmlFor="currency" className="block text-[13px] font-medium text-ink mb-1.5">Currency</label>
          <select id="currency" name="currency" defaultValue={merch?.currency ?? "USD"} className={inputCls()}>
            <option value="USD">USD</option>
            <option value="ZWL">ZWL</option>
            <option value="ZAR">ZAR</option>
            <option value="GBP">GBP</option>
          </select>
        </div>

        <div>
          <label htmlFor="stockQuantity" className="block text-[13px] font-medium text-ink mb-1.5">Stock quantity</label>
          <input id="stockQuantity" name="stockQuantity" type="number" min="0" step="1" defaultValue={merch?.stockQuantity ?? 0} className={inputCls(!!errs.stockQuantity)} />
          <FieldError message={errs.stockQuantity} />
        </div>

        <div>
          <label htmlFor="sizes" className="block text-[13px] font-medium text-ink mb-1.5">Sizes</label>
          <input id="sizes" name="sizes" type="text" defaultValue={(merch?.sizes ?? []).join(", ")} placeholder="S, M, L, XL" className={inputCls()} />
          <p className="mt-1 text-[11.5px] text-ink-3">Comma-separated. Leave blank for one-size items.</p>
        </div>

        <div>
          <label htmlFor="colors" className="block text-[13px] font-medium text-ink mb-1.5">Colors</label>
          <input id="colors" name="colors" type="text" defaultValue={(merch?.colors ?? []).join(", ")} placeholder="Black, White, Navy" className={inputCls()} />
          <p className="mt-1 text-[11.5px] text-ink-3">Comma-separated.</p>
        </div>
      </div>

      <div className="space-y-2">
        <label className="flex items-center gap-2 text-[13px] text-ink">
          <input type="checkbox" name="active" defaultChecked={merch?.active ?? true} className="h-4 w-4 rounded border-line text-navy focus:ring-blue/20" />
          Active (available to buy)
        </label>
        <label className="flex items-center gap-2 text-[13px] text-ink">
          <input type="checkbox" name="pickupAtEvent" defaultChecked={merch?.pickupAtEvent ?? true} className="h-4 w-4 rounded border-line text-navy focus:ring-blue/20" />
          Pickup at the event
        </label>
        <label className="flex items-center gap-2 text-[13px] text-ink">
          <input type="checkbox" name="deliveryAvailable" defaultChecked={merch?.deliveryAvailable ?? false} className="h-4 w-4 rounded border-line text-navy focus:ring-blue/20" />
          Delivery available
        </label>
      </div>

      <div className="flex items-center justify-end pt-2">
        <SubmitButton label={merch ? "Save changes" : "Add merch item"} />
      </div>
    </form>
  )
}
