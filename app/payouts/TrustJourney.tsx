import { CheckCircle2, Circle, Shield } from "lucide-react"

type TrustStep = "new" | "verified" | "trusted"

interface TrustJourneyProps {
  status: TrustStep
  totalPaidPayouts: number
}

const STEPS: {
  key: TrustStep
  label: string
  description: string
  next?: string
}[] = [
  {
    key: "new",
    label: "New",
    description: "Account created, identity not verified.",
    next: "Submit your ID for verification to unlock payout requests.",
  },
  {
    key: "verified",
    label: "Verified",
    description: "ID verified, can request payouts.",
    next: "Complete 3 paid payouts to reach Trusted status.",
  },
  {
    key: "trusted",
    label: "Trusted",
    description: "Established track record, priority payouts.",
  },
]

const STEP_INDEX: Record<TrustStep, number> = {
  new: 0,
  verified: 1,
  trusted: 2,
}

export default function TrustJourney({ status, totalPaidPayouts }: TrustJourneyProps) {
  const currentIndex = STEP_INDEX[status]
  const currentStep = STEPS[currentIndex]

  return (
    <div className="rounded-2xl border border-line bg-paper p-5 tp-fade-up-1">
      <div className="flex items-center gap-2 mb-4">
        <Shield size={15} className="text-ink-3" />
        <h2 className="text-[14px] font-semibold text-ink">Account trust level</h2>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-0 mb-5">
        {STEPS.map((step, idx) => {
          const isComplete = idx < currentIndex
          const isCurrent = idx === currentIndex
          const isLast = idx === STEPS.length - 1

          return (
            <div key={step.key} className="flex items-center flex-1 min-w-0">
              <div className="flex flex-col items-center shrink-0">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-colors ${
                    isComplete
                      ? "bg-ink border-ink text-white"
                      : isCurrent
                      ? "bg-paper border-ink text-ink"
                      : "bg-paper border-line text-ink-3"
                  }`}
                >
                  {isComplete ? (
                    <CheckCircle2 size={14} strokeWidth={2.5} />
                  ) : (
                    <span className="text-[11px] font-bold">{idx + 1}</span>
                  )}
                </div>
                <span
                  className={`mt-1.5 text-[11px] font-semibold whitespace-nowrap ${
                    isCurrent ? "text-ink" : isComplete ? "text-ink-2" : "text-ink-3"
                  }`}
                >
                  {step.label}
                </span>
              </div>
              {!isLast && (
                <div
                  className={`flex-1 h-0.5 mx-1 rounded-full transition-colors ${
                    idx < currentIndex ? "bg-ink" : "bg-line"
                  }`}
                />
              )}
            </div>
          )
        })}
      </div>

      {/* Status description */}
      <div className="rounded-xl border border-line bg-paper-2 px-4 py-3 space-y-1">
        <p className="text-[13px] font-semibold text-ink">{currentStep.description}</p>
        {currentStep.next && (
          <p className="text-[12px] text-ink-3">{currentStep.next}</p>
        )}
        {status === "verified" && (
          <p className="text-[12px] text-ink-3">
            {totalPaidPayouts} of 3 payouts completed.
          </p>
        )}
        {status === "trusted" && (
          <p className="text-[12px] text-emerald-700 font-medium">
            You&apos;re on the priority payout track.
          </p>
        )}
      </div>
    </div>
  )
}
