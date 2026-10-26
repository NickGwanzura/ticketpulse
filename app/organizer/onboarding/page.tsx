import { auth } from "@/auth"
import { db } from "@/db"
import { events, users } from "@/db/schema"
import { isValidWhatsappContact } from "@/lib/phone"
import { eq, desc } from "drizzle-orm"
import Link from "next/link"
import { redirect } from "next/navigation"
import { Check, ChevronRight, MailCheck, CalendarDays, Landmark } from "lucide-react"
import { saveOrganizerProfileAction } from "./actions"

export const metadata = { title: "Organiser registration — TicketPulse" }

const STEPS = ["Business", "Account", "Banking", "Initial event", "Review"]
const inputClass = "w-full rounded-xl border border-line bg-paper px-4 py-3 text-[14px] text-ink placeholder:text-ink-3 focus:outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10"

function StepIndicator({ current }: { current: number }) {
  return (
    <ol className="mb-10 grid grid-cols-5 gap-1" aria-label="Registration progress">
      {STEPS.map((label, index) => {
        const number = index + 1
        const done = current > number
        return (
          <li key={label} className="relative flex flex-col items-center gap-2 text-center">
            {index > 0 && <span className={`absolute right-1/2 top-5 -z-10 h-1 w-full ${done || current === number ? "bg-brand-600" : "bg-line"}`} />}
            <span aria-current={current === number ? "step" : undefined} className={`flex h-10 w-10 items-center justify-center rounded-full border-4 border-white text-sm font-bold shadow-sm ${done ? "bg-brand-600 text-white" : current === number ? "bg-brand-600 text-white" : "bg-paper-3 text-ink-3"}`}>
              {done ? <Check size={17} /> : number}
            </span>
            <span className={`text-[11px] sm:text-[13px] font-semibold ${current === number ? "text-ink" : "text-ink-3"}`}>{label}</span>
          </li>
        )
      })}
    </ol>
  )
}

function Field({ label, name, required = false, children }: { label: string; name: string; required?: boolean; children: React.ReactNode }) {
  return <div><label htmlFor={name} className="mb-1.5 block text-[13px] font-semibold text-ink">{label}{required && <span className="text-rose-600"> *</span>}</label>{children}</div>
}

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ step?: string; error?: string }> }) {
  const session = await auth()
  if (!session?.user?.id) redirect("/auth/signin?callbackUrl=/organizer/onboarding")

  const sp = await searchParams
  const requested = Number(sp.step ?? "1")
  const step = Number.isInteger(requested) ? Math.min(5, Math.max(1, requested)) : 1
  const [profile] = await db.select({
    role: users.role,
    name: users.name,
    email: users.email,
    emailVerified: users.emailVerified,
    phone: users.phone,
    approvedAt: users.approvedAt,
    organizerSlug: users.organizerSlug,
    organizerBio: users.organizerBio,
    organizerType: users.organizerType,
    organizerEntityName: users.organizerEntityName,
    organizerLocation: users.organizerLocation,
    organizerAddress: users.organizerAddress,
    organizerCategory: users.organizerCategory,
    organizerExperienceYears: users.organizerExperienceYears,
    organizerReferenceUrl: users.organizerReferenceUrl,
  }).from(users).where(eq(users.id, session.user.id)).limit(1)
  if (profile?.role !== "organizer" && profile?.role !== "admin") redirect("/dashboard")
  const businessComplete = Boolean(profile?.organizerEntityName && profile.organizerLocation && profile.organizerAddress && profile.organizerCategory && isValidWhatsappContact(profile.phone))
  if (step > 1 && !businessComplete) redirect("/organizer/onboarding?step=1")
  const ownEvents = step >= 4 ? await db.select({ id: events.id, title: events.title, status: events.status }).from(events).where(eq(events.organizerId, session.user.id)).orderBy(desc(events.createdAt)).limit(3) : []

  const errors: Record<string, string> = {
    slug_taken: "That public page handle is taken. Choose another.",
    whatsapp_required: "Enter a valid WhatsApp number with country code, such as +263 77 123 4567.",
    details_required: "Complete the required business fields and check the years of experience.",
    invalid_url: "Use a full website or social link beginning with https:// or http://.",
    generic: "We could not save these details. Please try again.",
  }

  return (
    <main className="min-h-screen bg-paper-2 px-4 py-10 md:px-8 md:py-14">
      <div className="mx-auto max-w-5xl">
        <div className="mb-10 text-center">
          <Link href="/" className="text-xl font-bold tracking-tight text-ink">TicketPulse</Link>
          <h1 className="mt-8 text-3xl font-bold tracking-tight text-ink md:text-4xl">Organiser registration</h1>
          <p className="mt-2 text-[15px] text-ink-2">Set up your organiser profile and prepare your first event.</p>
        </div>
        <StepIndicator current={step} />
        <div className="rounded-2xl border border-line bg-paper p-6 shadow-sm md:p-10">
          {step === 1 && <>
            <h2 className="text-2xl font-bold text-ink">Business information</h2>
            <p className="mt-1 mb-7 text-sm text-ink-2">Tell us about your organisation. This helps us review your account and support your events.</p>
            {sp.error && errors[sp.error] && <p role="alert" className="mb-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{errors[sp.error]}</p>}
            <form action={saveOrganizerProfileAction} className="space-y-5">
              <div className="grid gap-5 md:grid-cols-2">
                <Field label="Business or organiser name" name="organizerEntityName" required><input id="organizerEntityName" name="organizerEntityName" required maxLength={160} defaultValue={profile?.organizerEntityName ?? ""} placeholder="Enter business name" className={inputClass} /></Field>
                <Field label="Business email" name="businessEmail" required><input id="businessEmail" type="email" value={profile?.email ?? ""} readOnly className={`${inputClass} bg-paper-2`} /></Field>
                <Field label="Phone number" name="whatsappContact" required><input id="whatsappContact" type="tel" name="whatsappContact" required autoComplete="tel" defaultValue={profile?.phone ?? ""} placeholder="+263 77 123 4567" className={inputClass} /></Field>
                <Field label="Business type" name="organizerType" required><select id="organizerType" name="organizerType" required defaultValue={profile?.organizerType ?? ""} className={inputClass}><option value="" disabled>Select business type</option><option value="individual">Individual / sole trader</option><option value="business">Registered business</option><option value="community">Community group / organisation</option></select></Field>
                <Field label="Organiser category" name="organizerCategory" required><select id="organizerCategory" name="organizerCategory" required defaultValue={profile?.organizerCategory ?? ""} className={inputClass}><option value="" disabled>Select category</option><option value="concerts">Concerts and festivals</option><option value="conferences">Conferences and corporate</option><option value="sports">Sports and fitness</option><option value="arts">Arts and culture</option><option value="community">Community events</option><option value="other">Other</option></select></Field>
                <Field label="Years of experience" name="organizerExperienceYears"><input id="organizerExperienceYears" type="number" name="organizerExperienceYears" min="0" max="80" defaultValue={profile?.organizerExperienceYears ?? ""} placeholder="Optional" className={inputClass} /></Field>
              </div>
              <Field label="Business address" name="organizerAddress" required><input id="organizerAddress" name="organizerAddress" required maxLength={240} autoComplete="street-address" defaultValue={profile?.organizerAddress ?? ""} placeholder="Street address" className={inputClass} /></Field>
              <div className="grid gap-5 md:grid-cols-2">
                <Field label="City and country" name="organizerLocation" required><input id="organizerLocation" name="organizerLocation" required maxLength={120} defaultValue={profile?.organizerLocation ?? ""} placeholder="Harare, Zimbabwe" className={inputClass} /></Field>
                <Field label="Website or social page" name="organizerReferenceUrl"><input id="organizerReferenceUrl" type="url" name="organizerReferenceUrl" maxLength={300} defaultValue={profile?.organizerReferenceUrl ?? ""} placeholder="https://" className={inputClass} /></Field>
              </div>
              <Field label="Public page handle" name="organizerSlug"><div className="flex overflow-hidden rounded-xl border border-line"><span className="bg-paper-2 px-3 py-3 text-sm text-ink-3">ticketpulse.tech/o/</span><input id="organizerSlug" name="organizerSlug" maxLength={40} pattern="[a-zA-Z0-9\-]+" defaultValue={profile?.organizerSlug ?? ""} placeholder="your-name" className="min-w-0 flex-1 px-3 text-sm outline-none" /></div></Field>
              <Field label="Description" name="bio"><textarea id="bio" name="bio" rows={3} maxLength={280} defaultValue={profile?.organizerBio ?? ""} placeholder="Tell attendees about your organisation" className={inputClass} /></Field>
              <div className="flex justify-end pt-2"><button type="submit" className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-6 py-3 text-sm font-semibold text-white hover:bg-brand-700">Save and continue <ChevronRight size={16} /></button></div>
            </form>
          </>}
          {step === 2 && <>
            <MailCheck className="mb-4 text-brand-600" size={32} />
            <h2 className="text-2xl font-bold text-ink">Account</h2>
            <p className="mt-2 text-sm text-ink-2">Your account was created during signup. Confirm these details before continuing.</p>
            <dl className="mt-6 grid gap-4 rounded-xl bg-paper-2 p-5 text-sm md:grid-cols-2"><div><dt className="text-ink-3">Account name</dt><dd className="font-semibold text-ink">{profile?.name}</dd></div><div><dt className="text-ink-3">Email address</dt><dd className="font-semibold text-ink">{profile?.email}</dd></div><div><dt className="text-ink-3">WhatsApp contact</dt><dd className="font-semibold text-ink">{profile?.phone}</dd></div><div><dt className="text-ink-3">Email verification</dt><dd className="font-semibold text-ink">{profile?.emailVerified ? "Verified" : "Waiting for verification"}</dd></div></dl>
            {!profile?.emailVerified && <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Check your inbox for the verification link. You can review the next steps now, but email verification is required before creating an event. <a href="/api/auth/resend-verification" className="font-semibold underline">Resend verification email</a>.</div>}
            <div className="mt-8 flex justify-between gap-3"><Link href="?step=1" className="rounded-xl border border-line px-5 py-3 text-sm font-semibold">Back</Link><Link href="?step=3" className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-6 py-3 text-sm font-semibold text-white">Continue <ChevronRight size={16} /></Link></div>
          </>}
          {step === 3 && <>
            <Landmark className="mb-4 text-brand-600" size={32} />
            <h2 className="text-2xl font-bold text-ink">Banking and payouts</h2>
            <p className="mt-2 max-w-2xl text-sm text-ink-2">TicketPulse pays organisers in USD by bank transfer. You can add your bank name, account holder, and account number securely when you request your first payout. There is no need to share bank details before you have ticket sales.</p>
            <div className="mt-6 rounded-xl border border-line bg-paper-2 p-5 text-sm text-ink-2"><p className="font-semibold text-ink">Have these ready for your first payout:</p><ul className="mt-3 list-disc space-y-1 pl-5"><li>Bank name</li><li>Account holder name</li><li>Account number</li></ul></div>
            <div className="mt-8 flex justify-between gap-3"><Link href="?step=2" className="rounded-xl border border-line px-5 py-3 text-sm font-semibold">Back</Link><Link href="?step=4" className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-6 py-3 text-sm font-semibold text-white">Continue <ChevronRight size={16} /></Link></div>
          </>}
          {step === 4 && <>
            <CalendarDays className="mb-4 text-brand-600" size={32} />
            <h2 className="text-2xl font-bold text-ink">Initial event</h2>
            <p className="mt-2 text-sm text-ink-2">Create your first event as a draft. Add the venue, date, ticket tiers, and artwork before submitting it for review.</p>
            {ownEvents.length > 0 && <div className="mt-6 rounded-xl border border-line bg-paper-2 p-5"><p className="mb-3 text-sm font-semibold text-ink">Your events</p>{ownEvents.map(event => <Link key={event.id} href={`/organizer/events/${event.id}`} className="block py-2 text-sm text-brand-700 hover:underline">{event.title} · {(event.status ?? "draft").replaceAll("_", " ")}</Link>)}</div>}
            <div className="mt-6"><Link href="/organizer/events/new" className="inline-flex items-center gap-2 rounded-xl border border-brand-600 px-5 py-3 text-sm font-semibold text-brand-700 hover:bg-brand-50">Create first event <ChevronRight size={16} /></Link></div>
            {!profile?.emailVerified && <p className="mt-3 text-xs text-amber-700">Verify your email before creating a draft.</p>}
            <div className="mt-8 flex justify-between gap-3"><Link href="?step=3" className="rounded-xl border border-line px-5 py-3 text-sm font-semibold">Back</Link><Link href="?step=5" className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-6 py-3 text-sm font-semibold text-white">Review registration <ChevronRight size={16} /></Link></div>
          </>}
          {step === 5 && <>
            <h2 className="text-2xl font-bold text-ink">Review</h2>
            <p className="mt-2 text-sm text-ink-2">Your organiser profile has been saved. Review your details and continue to the dashboard.</p>
            <dl className="mt-6 grid gap-4 rounded-xl bg-paper-2 p-5 text-sm md:grid-cols-2"><div><dt className="text-ink-3">Organiser</dt><dd className="font-semibold text-ink">{profile?.organizerEntityName}</dd></div><div><dt className="text-ink-3">Category</dt><dd className="font-semibold text-ink">{profile?.organizerCategory}</dd></div><div><dt className="text-ink-3">Location</dt><dd className="font-semibold text-ink">{profile?.organizerLocation}</dd></div><div><dt className="text-ink-3">Account review</dt><dd className="font-semibold text-ink">{profile?.approvedAt ? "Approved" : "Pending review"}</dd></div><div><dt className="text-ink-3">Email</dt><dd className="font-semibold text-ink">{profile?.emailVerified ? "Verified" : "Verification needed"}</dd></div><div><dt className="text-ink-3">Events</dt><dd className="font-semibold text-ink">{ownEvents.length > 0 ? `${ownEvents.length} recent event${ownEvents.length === 1 ? "" : "s"}` : "No event yet"}</dd></div></dl>
            <p className="mt-5 text-xs text-ink-3">TicketPulse reviews organiser accounts before events can be published. You can prepare drafts while review is pending.</p>
            <div className="mt-8 flex justify-between gap-3"><Link href="?step=4" className="rounded-xl border border-line px-5 py-3 text-sm font-semibold">Back</Link><Link href="/organizer" className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-6 py-3 text-sm font-semibold text-white">Go to dashboard <ChevronRight size={16} /></Link></div>
          </>}
        </div>
        <p className="mt-6 text-center text-xs text-ink-3">Need help? <a href="mailto:support@ticketpulse.tech" className="text-brand-700 underline">Contact support</a></p>
      </div>
    </main>
  )
}
