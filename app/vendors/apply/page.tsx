import Link from "next/link"
import { Sparkles, ArrowRight, Check, ShieldCheck, Wallet, Calendar } from "lucide-react"
import { inputBaseClass } from "@/lib/utils"
import { applyVendorAction } from "./actions"

const PERKS = [
  { icon: Wallet,      title: "Verified payouts",  body: "USD settlement to bank or EcoCash after confirmed bookings are reconciled." },
  { icon: ShieldCheck, title: "Verification badge", body: "Earn the verified badge after your first 5 paid events on the platform." },
  { icon: Calendar,    title: "Calendar sync",      body: "We block your calendar automatically once an event is confirmed." },
]

export default async function VendorsApplyPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams

  return (
    <div className="bg-paper-2 min-h-[calc(100vh-4rem)]">
      <div className="max-w-5xl mx-auto px-5 md:px-8 py-12 md:py-20">
        <div className="grid lg:grid-cols-[1.1fr_1fr] gap-10 md:gap-14 items-start">
          {/* Intro */}
          <div>
            <Link href="/vendors" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-2 hover:text-ink transition-colors mb-6">
              <span className="opacity-60">←</span> Back to vendors
            </Link>
            <div className="inline-flex items-center gap-2 rounded-full border border-line bg-paper px-3 py-1.5 mb-5 shadow-sm shadow-ink/5">
              <Sparkles size={13} className="text-brand-600" />
              <span className="text-[11px] font-semibold tracking-[0.16em] text-ink uppercase">For vendors</span>
            </div>
            <h1 className="text-[36px] md:text-[48px] font-bold tracking-[-0.025em] leading-[1.05] text-ink">
              List your service. <span className="text-brand-600">Get booked.</span>
            </h1>
            <p className="mt-4 text-[15px] md:text-[16px] leading-relaxed text-ink-2 max-w-md">
              Join the marketplace organizers reach for first. Free to apply, we approve in 48 hours.
            </p>

            <ul className="mt-8 space-y-5">
              {PERKS.map(({ icon: Icon, title, body }) => (
                <li key={title} className="flex items-start gap-3.5">
                  <span className="shrink-0 inline-flex w-9 h-9 items-center justify-center rounded-xl bg-green-50 ring-1 ring-green-500/15 mt-0.5">
                    <Icon size={16} className="text-brand-600" />
                  </span>
                  <div>
                    <p className="text-[15px] font-semibold tracking-tight text-ink">{title}</p>
                    <p className="text-[14px] leading-relaxed text-ink-2 mt-0.5">{body}</p>
                  </div>
                </li>
              ))}
            </ul>

            <div className="mt-8 rounded-2xl border border-line bg-paper p-5">
              <p className="text-[11px] font-semibold tracking-[0.18em] text-ink-3 uppercase mb-3">Approval criteria</p>
              <ul className="space-y-2">
                {[
                  "Registered Zimbabwean business or sole-trader",
                  "Two recent client references",
                  "Public phone or email contact",
                  "Photos of past work (3+)",
                ].map((c) => (
                  <li key={c} className="flex items-center gap-2 text-[14px] text-ink-2">
                    <Check size={14} className="text-brand-600 shrink-0" />
                    {c}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Form */}
          <div className="rounded-2xl border border-line bg-paper p-6 md:p-8 shadow-sm shadow-ink/[0.04]">
            <h2 className="text-[20px] font-semibold tracking-tight text-ink mb-1">Apply to list</h2>
            <p className="text-xs text-ink-3 mb-6">Takes about 3 minutes. We&apos;ll email you within 48 hours.</p>

            {error === "invalid" && (
              <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] font-medium text-rose-700">
                Please check the highlighted details and submit again. Descriptions must be at least 30 characters.
              </div>
            )}
            {error === "forbidden" && (
              <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] font-medium text-rose-700">
                You do not have permission to apply as a vendor. Only attendees and current vendors can apply.
              </div>
            )}

            <form action={applyVendorAction} className="space-y-4">
              <div>
                <label htmlFor="businessName" className="block text-[12px] font-medium text-ink-2 mb-1.5">Business name</label>
                <input
                  id="businessName"
                  name="businessName"
                  type="text"
                  required
                  placeholder="e.g. Mama's Kitchen"
                  className={inputBaseClass}
                />
              </div>

              <div>
                <label htmlFor="category" className="block text-[12px] font-medium text-ink-2 mb-1.5">Category</label>
                <select
                  id="category"
                  name="category"
                  required
                  className="w-full bg-paper border border-line rounded-xl px-4 py-3 text-sm text-ink focus:outline-none focus:border-green-500 focus:ring-4 focus:ring-brand-500/10 transition"
                >
                  <option value="">Choose a category…</option>
                  <option value="catering">Catering</option>
                  <option value="bar">Bar service</option>
                  <option value="food_truck">Food truck</option>
                  <option value="photography">Photography</option>
                  <option value="sound">Sound &amp; AV</option>
                  <option value="security">Security</option>
                  <option value="decor">Decor</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="city" className="block text-[12px] font-medium text-ink-2 mb-1.5">Primary city</label>
                  <input
                    id="city"
                    name="city"
                    type="text"
                    required
                    placeholder="Harare"
                    className={inputBaseClass}
                  />
                </div>
                <div>
                  <label htmlFor="phone" className="block text-[12px] font-medium text-ink-2 mb-1.5">Phone</label>
                  <input
                    id="phone"
                    name="phone"
                    type="tel"
                    required
                    placeholder="+263 77…"
                    className={inputBaseClass}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="email" className="block text-[12px] font-medium text-ink-2 mb-1.5">Contact email</label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  placeholder="hello@yourbusiness.co.zw"
                  className={inputBaseClass}
                />
              </div>

              <div>
                <label htmlFor="description" className="block text-[12px] font-medium text-ink-2 mb-1.5">About your service</label>
                <textarea
                  id="description"
                  name="description"
                  rows={4}
                  required
                  minLength={30}
                  placeholder="What do you offer, who are your past clients, what makes you the right pick?"
                  className={`${inputBaseClass} resize-none`}
                />
              </div>

              <div>
                <label htmlFor="portfolioLink" className="block text-[12px] font-medium text-ink-2 mb-1.5">Portfolio link (optional)</label>
                <input
                  id="portfolioLink"
                  name="portfolioLink"
                  type="url"
                  placeholder="https://…"
                  className={inputBaseClass}
                />
              </div>

              <label className="flex items-start gap-2.5 text-[13px] text-ink-2 leading-relaxed pt-2">
                <input type="checkbox" name="terms" required className="mt-0.5 accent-navy" />
                <span>
                  I agree to the <Link href="/legal/terms" className="text-navy font-semibold hover:underline">Vendor Terms</Link> and confirm the information above is accurate.
                </span>
              </label>

              <button
                type="submit"
                className="w-full inline-flex items-center justify-center gap-2 bg-brand-600 text-white font-semibold py-3.5 rounded-xl hover:bg-brand-700 active:scale-[0.99] transition shadow-sm shadow-brand-600/20 text-sm mt-2"
              >
                Submit application <ArrowRight size={15} />
              </button>
              <p className="text-[12px] text-ink-3 text-center">No fee. Cancel any time.</p>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
