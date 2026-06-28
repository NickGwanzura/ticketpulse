import { auth } from "@/auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import { CheckCircle2, ChevronRight, Rocket, User, Calendar } from "lucide-react"
import { saveOrganizerProfileAction } from "./actions"

export const metadata = { title: "Get started — TicketPulse" }

const STEPS = [
  { n: 1, label: "Welcome" },
  { n: 2, label: "Your profile" },
  { n: 3, label: "First event" },
]

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {STEPS.map(({ n, label }, i) => {
        const done = current > n
        const active = current === n
        return (
          <div key={n} className="flex items-center gap-2">
            <div className={`flex items-center gap-2 ${active ? "text-ink" : done ? "text-brand-600" : "text-ink-3"}`}>
              <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-[12px] font-bold shrink-0 ${
                done ? "bg-brand-600 text-white" : active ? "bg-ink text-white" : "bg-paper-3 text-ink-3"
              }`}>
                {done ? <CheckCircle2 size={14} className="text-white" /> : n}
              </span>
              <span className={`text-[13px] font-medium hidden sm:block ${active ? "text-ink" : done ? "text-brand-600" : "text-ink-3"}`}>
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`w-8 sm:w-12 h-px mx-1 ${current > n ? "bg-brand-600" : "bg-line"}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ step?: string; error?: string }>
}) {
  const session = await auth()
  if (!session?.user?.id) redirect("/auth/signin?callbackUrl=/organizer/onboarding")

  const sp = await searchParams
  const step = Number(sp.step ?? "1")
  const error = sp.error

  return (
    <div
      className="min-h-screen px-4 py-10 md:py-16"
      style={{
        background:
          "radial-gradient(800px 400px at 80% -10%, #DBE8FB 0%, transparent 55%), linear-gradient(180deg, #F6F9FC 0%, #FFFFFF 100%)",
      }}
    >
      <div className="max-w-lg mx-auto">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 font-bold text-xl tracking-tight text-ink">
            <span className="relative inline-flex w-6 h-6 items-center justify-center rounded-md bg-navy">
              <span className="block w-1.5 h-1.5 rounded-full bg-white" />
            </span>
            TicketPulse
          </Link>
        </div>

        <StepIndicator current={step} />

        {step === 1 && (
          <div className="rounded-2xl border border-line bg-paper p-8 shadow-sm text-center">
            <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-navy/8 text-navy mb-5">
              <Rocket size={24} />
            </span>
            <h1 className="text-[24px] font-bold tracking-tight text-ink mb-2">
              Welcome, {session.user.name?.split(" ")[0] ?? "organizer"}!
            </h1>
            <p className="text-[14px] text-ink-2 mb-8 max-w-sm mx-auto">
              You&apos;re set up as an organizer on TicketPulse. Let&apos;s get your profile ready so attendees can find your events.
            </p>
            <div className="space-y-3 text-left mb-8">
              {[
                "Set your public organizer profile",
                "Create your first event with ticket tiers",
                "Share your link and start selling",
              ].map((s) => (
                <div key={s} className="flex items-center gap-3 text-[13px] text-ink-2">
                  <CheckCircle2 size={16} className="text-brand-600 shrink-0" />
                  {s}
                </div>
              ))}
            </div>
            <Link
              href="/organizer/onboarding?step=2"
              className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-6 py-3 text-[14px] font-semibold text-white shadow-sm shadow-brand-600/20 hover:bg-brand-700 transition"
            >
              Get started <ChevronRight size={15} />
            </Link>
          </div>
        )}

        {step === 2 && (
          <div className="rounded-2xl border border-line bg-paper p-8 shadow-sm">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-navy/8 text-navy mb-4">
              <User size={20} />
            </span>
            <h1 className="text-[22px] font-bold tracking-tight text-ink mb-1">Your organizer profile</h1>
            <p className="text-[13px] text-ink-2 mb-6">
              This shows on your public organizer page. You can change it any time from your account settings.
            </p>

            {error === "slug_taken" && (
              <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] text-rose-700">
                That URL handle is already taken — try a different one.
              </div>
            )}

            <form action={saveOrganizerProfileAction} className="space-y-5">
              <div>
                <label className="block text-[13px] font-semibold text-ink mb-1.5">
                  Organizer name <span className="text-ink-3 font-normal">(from your account)</span>
                </label>
                <input
                  type="text"
                  value={session.user.name ?? ""}
                  readOnly
                  className="w-full rounded-xl border border-line bg-paper-2 px-4 py-3 text-[14px] text-ink-2 cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-[13px] font-semibold text-ink mb-1.5">
                  Your page URL handle
                </label>
                <div className="flex items-center rounded-xl border border-line bg-paper overflow-hidden focus-within:border-green-500 focus-within:ring-4 focus-within:ring-brand-500/10 transition">
                  <span className="px-3 py-3 text-[13px] text-ink-3 bg-paper-2 border-r border-line shrink-0">
                    ticketpulse.com/o/
                  </span>
                  <input
                    type="text"
                    name="organizerSlug"
                    placeholder={session.user.name ? session.user.name.toLowerCase().replace(/\s+/g, "-") : "your-name"}
                    maxLength={40}
                    pattern="[a-zA-Z0-9\-]+"
                    className="flex-1 px-3 py-3 text-[14px] text-ink bg-transparent focus:outline-none"
                  />
                </div>
                <p className="text-[11px] text-ink-3 mt-1">Letters, numbers, and hyphens only.</p>
              </div>

              <div>
                <label className="block text-[13px] font-semibold text-ink mb-1.5">
                  Bio <span className="text-ink-3 font-normal">(optional)</span>
                </label>
                <textarea
                  name="bio"
                  rows={3}
                  maxLength={280}
                  placeholder="Tell attendees who you are and what kind of events you organize..."
                  className="w-full rounded-xl border border-line bg-paper px-4 py-3 text-[14px] text-ink placeholder:text-ink-3 focus:outline-none focus:border-green-500 focus:ring-4 focus:ring-brand-500/10 transition resize-none"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-6 py-3 text-[14px] font-semibold text-white shadow-sm shadow-brand-600/20 hover:bg-brand-700 transition"
                >
                  Save & continue <ChevronRight size={15} />
                </button>
                <Link
                  href="/organizer/onboarding?step=3"
                  className="text-[13px] text-ink-3 hover:text-ink-2 transition"
                >
                  Skip for now
                </Link>
              </div>
            </form>
          </div>
        )}

        {step === 3 && (
          <div className="rounded-2xl border border-line bg-paper p-8 shadow-sm text-center">
            <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 mb-5">
              <CheckCircle2 size={28} />
            </span>
            <h1 className="text-[22px] font-bold tracking-tight text-ink mb-2">You&apos;re all set!</h1>
            <p className="text-[14px] text-ink-2 mb-8 max-w-sm mx-auto">
              Profile saved. Now create your first event — it only takes a few minutes to go live.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/organizer/events/new"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-6 py-3 text-[14px] font-semibold text-white shadow-sm shadow-brand-600/20 hover:bg-brand-700 transition"
              >
                <Calendar size={16} /> Create first event
              </Link>
              <Link
                href="/organizer"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-line bg-paper px-6 py-3 text-[14px] font-semibold text-ink hover:bg-paper-2 transition"
              >
                Go to dashboard
              </Link>
            </div>
          </div>
        )}

        <p className="text-center text-[12px] text-ink-3 mt-6">
          Need help?{" "}
          <a href="mailto:support@ticketpulse.co.zw" className="text-navy hover:underline">
            Contact support
          </a>
        </p>
      </div>
    </div>
  )
}
