"use client"

import Link from "next/link"
import { useActionState, useState } from "react"
import { ArrowRight } from "lucide-react"
import { inputBaseClass } from "@/lib/utils"
import { applyVendorAction, initialVendorApplyState } from "./actions"

export type ApplicationDefaults = {
  businessName: string
  category: string
  city: string
  phone: string
  description: string
  portfolioLink: string
}

const categories = [
  ["catering", "Catering"], ["bar", "Bar service"], ["food_truck", "Food truck"],
  ["photography", "Photography"], ["sound", "Sound & AV"], ["security", "Security"],
  ["decor", "Decor"], ["other", "Other"],
] as const

export default function VendorApplicationForm({ email, defaults, resubmitting }: {
  email: string
  defaults: ApplicationDefaults
  resubmitting: boolean
}) {
  const [state, action, pending] = useActionState(applyVendorAction, initialVendorApplyState)
  const error = (field: string) => state.fieldErrors[field]?.[0]
  const [businessName, setBusinessName] = useState(defaults.businessName)
  const [category, setCategory] = useState(defaults.category)
  const [city, setCity] = useState(defaults.city)
  const [phone, setPhone] = useState(defaults.phone)
  const [description, setDescription] = useState(defaults.description)
  const [portfolioLink, setPortfolioLink] = useState(defaults.portfolioLink)
  const [termsAccepted, setTermsAccepted] = useState(false)

  return (
    <form action={action} className="space-y-4">
      {state.error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] font-medium text-rose-700">{state.error}</div>}

      <div>
        <label htmlFor="businessName" className="block text-[12px] font-medium text-ink-2 mb-1.5">Business name</label>
        <input id="businessName" name="businessName" type="text" required value={businessName} onChange={(event) => setBusinessName(event.target.value)} placeholder="e.g. Mama's Kitchen" aria-invalid={!!error("businessName")} aria-describedby={error("businessName") ? "businessName-error" : undefined} className={inputBaseClass} />
        {error("businessName") && <p id="businessName-error" className="mt-1 text-xs text-rose-700">{error("businessName")}</p>}
      </div>

      <div>
        <label htmlFor="category" className="block text-[12px] font-medium text-ink-2 mb-1.5">Category</label>
        <select id="category" name="category" required value={category} onChange={(event) => setCategory(event.target.value)} aria-invalid={!!error("category")} aria-describedby={error("category") ? "category-error" : undefined} className="w-full bg-paper border border-line rounded-xl px-4 py-3 text-sm text-ink focus:outline-none focus:border-green-500 focus:ring-4 focus:ring-brand-500/10 transition">
          <option value="">Choose a category…</option>
          {categories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        {error("category") && <p id="category-error" className="mt-1 text-xs text-rose-700">{error("category")}</p>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="city" className="block text-[12px] font-medium text-ink-2 mb-1.5">Primary city</label>
          <input id="city" name="city" type="text" required value={city} onChange={(event) => setCity(event.target.value)} placeholder="Harare" aria-invalid={!!error("city")} aria-describedby={error("city") ? "city-error" : undefined} className={inputBaseClass} />
          {error("city") && <p id="city-error" className="mt-1 text-xs text-rose-700">{error("city")}</p>}
        </div>
        <div>
          <label htmlFor="phone" className="block text-[12px] font-medium text-ink-2 mb-1.5">Phone</label>
          <input id="phone" name="phone" type="tel" required value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+263 77…" aria-invalid={!!error("phone")} aria-describedby={error("phone") ? "phone-error" : undefined} className={inputBaseClass} />
          {error("phone") && <p id="phone-error" className="mt-1 text-xs text-rose-700">{error("phone")}</p>}
        </div>
      </div>

      <div>
        <label className="block text-[12px] font-medium text-ink-2 mb-1.5">Booking email</label>
        <p className="rounded-xl border border-line bg-paper-2 px-4 py-3 text-sm text-ink">{email}</p>
        <p className="mt-1 text-xs text-ink-3">Booking requests go to this address after you verify it. Change it in account settings.</p>
      </div>

      <div>
        <label htmlFor="description" className="block text-[12px] font-medium text-ink-2 mb-1.5">About your service</label>
        <textarea id="description" name="description" rows={4} required minLength={30} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="What do you offer, who are your past clients, what makes you the right pick?" aria-invalid={!!error("description")} aria-describedby={error("description") ? "description-error" : undefined} className={`${inputBaseClass} resize-none`} />
        {error("description") && <p id="description-error" className="mt-1 text-xs text-rose-700">{error("description")}</p>}
      </div>

      <div>
        <label htmlFor="portfolioLink" className="block text-[12px] font-medium text-ink-2 mb-1.5">Portfolio link (optional)</label>
        <input id="portfolioLink" name="portfolioLink" type="url" value={portfolioLink} onChange={(event) => setPortfolioLink(event.target.value)} placeholder="https://…" aria-invalid={!!error("portfolioLink")} aria-describedby={error("portfolioLink") ? "portfolioLink-error" : undefined} className={inputBaseClass} />
        {error("portfolioLink") && <p id="portfolioLink-error" className="mt-1 text-xs text-rose-700">{error("portfolioLink")}</p>}
      </div>

      <label className="flex items-start gap-2.5 text-[13px] text-ink-2 leading-relaxed pt-2">
        <input type="checkbox" name="terms" required checked={termsAccepted} onChange={(event) => setTermsAccepted(event.target.checked)} className="mt-0.5 accent-navy" />
        <span>I agree to the <Link href="/legal/terms" className="text-navy font-semibold hover:underline">Vendor Terms</Link> and confirm the information above is accurate.</span>
      </label>
      {error("terms") && <p className="text-xs text-rose-700">Please accept the Vendor Terms.</p>}

      <button type="submit" disabled={pending} className="w-full inline-flex items-center justify-center gap-2 bg-brand-600 text-white font-semibold py-3.5 rounded-xl hover:bg-brand-700 active:scale-[0.99] transition shadow-sm shadow-brand-600/20 text-sm mt-2 disabled:opacity-60">
        {pending ? "Submitting…" : resubmitting ? "Resubmit for review" : "Submit application"} <ArrowRight size={15} />
      </button>
      <p className="text-[12px] text-ink-3 text-center">No fee. Cancel any time.</p>
    </form>
  )
}
