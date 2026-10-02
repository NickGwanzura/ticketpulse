import Link from "next/link"
import { ArrowRight, CheckCircle2, ChevronDown, ShieldCheck } from "lucide-react"

export const TRUSTED_PAYOUT_TARGET = 3

type TrustStep = "new" | "verified" | "trusted"

interface TrustJourneyProps {
  status: TrustStep
  totalPaidPayouts: number
}

const STEPS: { key: TrustStep; label: string; requirement: string }[] = [
  { key: "new", label: "New", requirement: "Account created" },
  { key: "verified", label: "Verified", requirement: "Organizer approved" },
  { key: "trusted", label: "Trusted", requirement: `${TRUSTED_PAYOUT_TARGET} payouts paid` },
]

const STATUS_CONTENT = {
  new: {
    title: "Your account is awaiting approval",
    description: "TicketPulse has not approved your organizer account yet.",
    next: "Check that your profile and contact details are up to date. Contact support if you need help with approval.",
    href: "/account",
    action: "Review account details",
  },
  verified: {
    title: "Your organizer account is approved",
    description: "You are building a payout history with TicketPulse.",
    href: "#payout-history",
    action: "View payout history",
  },
  trusted: {
    title: "You have an established payout history",
    description: `Your organizer account is approved and at least ${TRUSTED_PAYOUT_TARGET} payouts have been paid.`,
    next: "Keep your contact details up to date and check your settlement details when requesting your next payout.",
    href: "/account",
    action: "Review account details",
  },
}

const linkFocus = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"

export default function TrustJourney({ status, totalPaidPayouts }: TrustJourneyProps) {
  const currentIndex = STEPS.findIndex((step) => step.key === status)
  const currentStep = STEPS[currentIndex]
  const content = STATUS_CONTENT[status]
  const paidCount = Math.max(0, Math.floor(Number.isFinite(totalPaidPayouts) ? totalPaidPayouts : 0))
  const progress = Math.min(paidCount, TRUSTED_PAYOUT_TARGET)
  const remaining = TRUSTED_PAYOUT_TARGET - progress

  return (
    <section aria-labelledby="account-trust-heading" className="rounded-2xl border border-border bg-card p-5 md:p-6 tp-fade-up-1">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-foreground">
            <ShieldCheck size={20} aria-hidden="true" />
          </span>
          <div>
            <h2 id="account-trust-heading" className="text-[16px] font-semibold tracking-tight text-foreground">Account trust level</h2>
            <p className="mt-1 text-[13px] text-muted-foreground">Based on organizer approval and completed payouts.</p>
          </div>
        </div>
        <span className="rounded-full border border-border bg-secondary px-3 py-1 text-[12px] font-semibold text-foreground">
          Current level: {currentStep.label}
        </span>
      </div>

      <p className="mt-4 text-[13px] leading-relaxed text-muted-foreground">
        <span className="font-semibold text-foreground">Nothing to worry about.</span>{" "}
        New and Verified are normal stages for organizers. Your level simply reflects account approval and payout history. A lower level on its own does not mean there is a problem with your account.
      </p>

      <ol aria-label="Account trust levels" className="my-6 grid grid-cols-3 gap-2 sm:gap-3">
        {STEPS.map((step, idx) => {
          const isComplete = idx < currentIndex
          const isCurrent = idx === currentIndex

          return (
            <li
              key={step.key}
              aria-current={isCurrent ? "step" : undefined}
              className={`min-w-0 rounded-xl border p-3 sm:p-4 ${isCurrent ? "border-foreground bg-secondary" : "border-border"}`}
            >
              <span aria-hidden="true" className={`mb-3 inline-flex h-7 w-7 items-center justify-center rounded-full text-[12px] font-bold ${isComplete ? "bg-foreground text-background" : "border border-border text-foreground"}`}>
                {isComplete ? <CheckCircle2 size={16} /> : idx + 1}
              </span>
              <p className="text-[13px] font-semibold text-foreground">{step.label}</p>
              <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{step.requirement}</p>
              <span className="sr-only">{isComplete ? "Completed" : isCurrent ? "Current level" : "Upcoming level"}</span>
            </li>
          )
        })}
      </ol>

      <div className="rounded-xl border border-border bg-secondary p-4 sm:p-5">
        <p className="text-[14px] font-semibold text-foreground">{content.title}</p>
        <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{content.description}</p>

        {status === "verified" && (
          <div className="mt-4">
            <div className="flex flex-wrap items-center justify-between gap-2 text-[12px]">
              <span className="font-semibold text-foreground">Progress to Trusted</span>
              <span className="text-muted-foreground">{progress} of {TRUSTED_PAYOUT_TARGET} payouts paid</span>
            </div>
            <div
              role="progressbar"
              aria-label="Paid payouts toward Trusted status"
              aria-valuemin={0}
              aria-valuemax={TRUSTED_PAYOUT_TARGET}
              aria-valuenow={progress}
              aria-valuetext={`${progress} of ${TRUSTED_PAYOUT_TARGET} payouts paid`}
              className="mt-2 h-2 overflow-hidden rounded-full bg-border"
            >
              <div className="h-full rounded-full bg-foreground" style={{ width: `${progress / TRUSTED_PAYOUT_TARGET * 100}%` }} />
            </div>
            <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">Only payouts marked Paid count. Pending or approved requests count once paid.</p>
          </div>
        )}

        {status === "trusted" && (
          <p className="mt-3 flex items-center gap-2 text-[13px] font-semibold text-foreground">
            <CheckCircle2 size={16} aria-hidden="true" /> {paidCount} paid payouts completed
          </p>
        )}

        <div className="mt-4 border-t border-border pt-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Next step</p>
          <p className="mt-1 text-[13px] leading-relaxed text-foreground">
            {status === "verified"
              ? `Complete ${remaining} more paid payout${remaining === 1 ? "" : "s"} to reach Trusted. Your level updates automatically when payouts are marked Paid.`
              : "next" in content ? content.next : null}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-3">
            <Link href={content.href} className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-[12px] font-semibold text-primary-foreground hover:bg-brand-700 transition-colors ${linkFocus}`}>
              {content.action} <ArrowRight size={14} aria-hidden="true" />
            </Link>
            <Link href="/contact" className={`rounded-md py-2 text-[12px] font-semibold text-foreground underline underline-offset-4 ${linkFocus}`}>Contact support</Link>
          </div>
        </div>
      </div>

      <details className="group mt-4">
        <summary className={`flex min-h-10 cursor-pointer list-none items-center justify-between gap-3 rounded-lg text-[13px] font-semibold text-foreground [&::-webkit-details-marker]:hidden ${linkFocus}`}>
          How trust levels work
          <ChevronDown size={16} aria-hidden="true" className="shrink-0 transition-transform group-open:rotate-180" />
        </summary>
        <div className="mt-1 space-y-2 text-[12px] leading-relaxed text-muted-foreground">
          <p>New means your account is awaiting organizer approval. Verified means TicketPulse has approved your organizer account. Trusted means an approved account has completed at least {TRUSTED_PAYOUT_TARGET} paid payouts.</p>
          <p>Your trust level reflects approval and payout history. Payout availability depends on your available balance, and every request is reviewed by TicketPulse. Trusted status does not guarantee a faster transfer.</p>
          <Link href="/help/organizers" className={`inline-flex min-h-10 items-center gap-1 rounded-md font-semibold text-foreground underline underline-offset-4 ${linkFocus}`}>Read the organizer payout guide <ArrowRight size={12} aria-hidden="true" /></Link>
        </div>
      </details>
    </section>
  )
}
