"use client"

import { useState, useTransition } from "react"
import { Mail, Phone, MapPin, Tag, Building2, Check, AlertCircle } from "lucide-react"

import ImageUploader from "@/components/ui/ImageUploader"
import { updateVendorProfile } from "./actions"

type InitialState = {
  businessName: string
  description:  string
  phone:        string
  email:        string
  city:         string
  priceRange:   string
  logo:         string | null
  portfolio:    string[]
}

type Props = {
  vendorId: string
  initial:  InitialState
}

type Status =
  | { kind: "idle" }
  | { kind: "saved" }
  | { kind: "error"; message: string }

export default function VendorDashboardForm({ vendorId, initial }: Props) {
  const [businessName, setBusinessName] = useState(initial.businessName)
  const [description, setDescription]   = useState(initial.description)
  const [phone, setPhone]               = useState(initial.phone)
  const [email, setEmail]               = useState(initial.email)
  const [city, setCity]                 = useState(initial.city)
  const [priceRange, setPriceRange]     = useState(initial.priceRange)
  const [logo, setLogo]                 = useState<string | null>(initial.logo)
  const [portfolio, setPortfolio]       = useState<string[]>(initial.portfolio)

  const [status, setStatus] = useState<Status>({ kind: "idle" })
  const [pending, startTransition] = useTransition()

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setStatus({ kind: "idle" })
    startTransition(async () => {
      const result = await updateVendorProfile({
        businessName: businessName.trim(),
        description:  description.trim() || null,
        phone:        phone.trim() || null,
        email:        email.trim() || null,
        city:         city.trim() || null,
        priceRange:   priceRange.trim() || null,
        logo,
        portfolio,
      })
      if (result.ok) {
        setStatus({ kind: "saved" })
      } else {
        setStatus({ kind: "error", message: result.error })
      }
    })
  }

  return (
    <form onSubmit={onSubmit} className="space-y-10">
      {/* Profile section */}
      <section>
        <p className="text-[11px] font-semibold tracking-[0.18em] text-blue uppercase mb-2">Profile</p>
        <h2 className="text-[22px] font-bold tracking-tight text-ink mb-5">Business details</h2>

        <div className="rounded-2xl border border-line bg-paper p-6 md:p-7 space-y-6">
          <ImageUploader
            kind="vendor-logo"
            vendorId={vendorId}
            value={logo}
            onChange={setLogo}
            aspectRatio="square"
            label="Logo"
            helperText="2 MB max. JPEG, PNG, WebP, AVIF."
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label htmlFor="businessName" className="block text-[11.5px] font-medium text-ink-2 mb-1.5">
                Business name
              </label>
              <div className="relative">
                <Building2 size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-3" />
                <input
                  id="businessName"
                  type="text"
                  required
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  className="w-full bg-paper border border-line rounded-xl pl-10 pr-4 py-3 text-sm text-ink placeholder:text-ink-3 focus:outline-none focus:border-green-500 focus:ring-4 focus:ring-green-500/10 transition"
                />
              </div>
            </div>

            <div className="md:col-span-2">
              <label htmlFor="description" className="block text-[11.5px] font-medium text-ink-2 mb-1.5">
                About your service
              </label>
              <textarea
                id="description"
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What do you offer, who are your past clients, what makes you the right pick?"
                className="w-full bg-paper border border-line rounded-xl px-4 py-3 text-sm text-ink placeholder:text-ink-3 focus:outline-none focus:border-green-500 focus:ring-4 focus:ring-green-500/10 transition resize-none"
              />
            </div>

            <div>
              <label htmlFor="phone" className="block text-[11.5px] font-medium text-ink-2 mb-1.5">
                Phone
              </label>
              <div className="relative">
                <Phone size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-3" />
                <input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+263 77…"
                  className="w-full bg-paper border border-line rounded-xl pl-10 pr-4 py-3 text-sm text-ink placeholder:text-ink-3 focus:outline-none focus:border-green-500 focus:ring-4 focus:ring-green-500/10 transition"
                />
              </div>
            </div>

            <div>
              <label htmlFor="email" className="block text-[11.5px] font-medium text-ink-2 mb-1.5">
                Contact email
              </label>
              <div className="relative">
                <Mail size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-3" />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="hello@yourbusiness.co.zw"
                  className="w-full bg-paper border border-line rounded-xl pl-10 pr-4 py-3 text-sm text-ink placeholder:text-ink-3 focus:outline-none focus:border-green-500 focus:ring-4 focus:ring-green-500/10 transition"
                />
              </div>
            </div>

            <div>
              <label htmlFor="city" className="block text-[11.5px] font-medium text-ink-2 mb-1.5">
                Primary city
              </label>
              <div className="relative">
                <MapPin size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-3" />
                <input
                  id="city"
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Harare"
                  className="w-full bg-paper border border-line rounded-xl pl-10 pr-4 py-3 text-sm text-ink placeholder:text-ink-3 focus:outline-none focus:border-green-500 focus:ring-4 focus:ring-green-500/10 transition"
                />
              </div>
            </div>

            <div>
              <label htmlFor="priceRange" className="block text-[11.5px] font-medium text-ink-2 mb-1.5">
                Price range
              </label>
              <div className="relative">
                <Tag size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-3" />
                <input
                  id="priceRange"
                  type="text"
                  value={priceRange}
                  onChange={(e) => setPriceRange(e.target.value)}
                  placeholder="e.g. From $250"
                  className="w-full bg-paper border border-line rounded-xl pl-10 pr-4 py-3 text-sm text-ink placeholder:text-ink-3 focus:outline-none focus:border-green-500 focus:ring-4 focus:ring-green-500/10 transition"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Portfolio section */}
      <section>
        <p className="text-[11px] font-semibold tracking-[0.18em] text-blue uppercase mb-2">Portfolio</p>
        <h2 className="text-[22px] font-bold tracking-tight text-ink mb-5">Showcase your work</h2>

        <div className="rounded-2xl border border-line bg-paper p-6 md:p-7">
          <ImageUploader
            kind="vendor-portfolio"
            vendorId={vendorId}
            multiple
            values={portfolio}
            onValuesChange={setPortfolio}
            maxItems={12}
            aspectRatio="square"
            label="Portfolio"
            helperText="Up to 12 images, 8 MB each. Drag to reorder."
          />
        </div>
      </section>

      {/* Save bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-3 pt-2">
        <div className="flex-1 min-h-[1.25rem]" aria-live="polite">
          {status.kind === "saved" && (
            <p className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-green-700">
              <Check size={14} /> Profile saved.
            </p>
          )}
          {status.kind === "error" && (
            <p className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-rose-700">
              <AlertCircle size={14} /> {status.message}
            </p>
          )}
        </div>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center justify-center rounded-xl bg-green-600 text-white text-sm font-semibold px-5 py-2.5 hover:bg-green-700 transition-colors shadow-sm shadow-green-600/20 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {pending ? "Saving…" : "Save changes"}
        </button>
      </div>
    </form>
  )
}
