import Link from "next/link"
import { Sparkles, ArrowRight, Check, ShieldCheck, MessageSquare, ListChecks } from "lucide-react"
import { eq } from "drizzle-orm"
import { db } from "@/db"
import { vendors } from "@/db/schema"
import VendorApplicationForm from "./VendorApplicationForm"
import { auth } from "@/auth"

const PERKS = [
  { icon: MessageSquare, title: "Direct enquiries", body: "Receive event requests in your dashboard and reply to clients directly." },
  { icon: ShieldCheck, title: "Reviewed profile", body: "Approved vendors appear in the public marketplace with a verification badge." },
  { icon: ListChecks, title: "Service packages", body: "Publish clear packages and prices so clients know what to ask for." },
]

export default async function VendorsApplyPage() {
  const session = await auth()
  const canApply = session?.user?.role === "vendor" || session?.user?.role === "attendee" || session?.user?.role === "admin"
  const [existing] = session?.user?.id
    ? await db.select().from(vendors).where(eq(vendors.userId, session.user.id)).limit(1)
    : [undefined]
  const portfolio = Array.isArray(existing?.portfolio) ? existing.portfolio : []
  const defaults = {
    businessName: existing?.businessName ?? "",
    category: existing?.category ?? "",
    city: existing?.city ?? "",
    phone: existing?.phone ?? "",
    description: existing?.description ?? "",
    portfolioLink: portfolio[0] ?? "",
  }

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
              Apply for a free listing, build your profile, and receive event booking requests from clients.
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
                  "A reachable phone and email",
                  "Describe your service and add work examples from your dashboard",
                  "We’ll follow up if more details are needed for review",
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
            <h2 className="text-[20px] font-semibold tracking-tight text-ink mb-1">{existing ? "Update your application" : "Apply to list"}</h2>
            <p className="text-xs text-ink-3 mb-6">{existing?.verified ? "Submitting changes will temporarily hide your listing until an admin approves it again." : "Share the basics now. Add a description and photos later from your dashboard."}</p>

            {!session && (
              <div className="space-y-3">
                <p className="text-[14px] leading-relaxed text-ink-2">Create a vendor account to submit your business details and manage enquiries in one place.</p>
                <Link href="/auth/signup?role=vendor&callbackUrl=/vendors/apply" className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-3.5 text-sm font-semibold text-white hover:bg-brand-700">Create vendor account <ArrowRight size={15} /></Link>
                <Link href="/auth/signin?callbackUrl=/vendors/apply" className="flex w-full items-center justify-center rounded-xl border border-line px-4 py-3.5 text-sm font-semibold text-ink hover:bg-paper-2">Already have an account? Sign in</Link>
              </div>
            )}
            {session && !canApply && <p className="text-[14px] text-ink-2">This account cannot submit a vendor application. Use a vendor or attendee account.</p>}
            {canApply && !session?.user?.email && <p className="text-sm text-rose-700">Add an email address to your account before applying.</p>}
            {canApply && session?.user?.email && (
              <VendorApplicationForm email={session.user.email} defaults={defaults} resubmitting={!!existing} />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
