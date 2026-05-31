import { Check, ShoppingBag, User, HelpCircle, CreditCard, Ticket } from "lucide-react"

const STEPS = [
  { id: "cart",      label: "Cart",      Icon: ShoppingBag },
  { id: "details",   label: "Details",   Icon: User },
  { id: "questions", label: "Questions", Icon: HelpCircle },
  { id: "pay",       label: "Payment",   Icon: CreditCard },
  { id: "done",      label: "Tickets",   Icon: Ticket },
] as const

type StepId = (typeof STEPS)[number]["id"]

export default function CheckoutSteps({ active }: { active: StepId }) {
  const activeIdx = STEPS.findIndex((s) => s.id === active)

  return (
    <ol className="flex items-center gap-1 md:gap-2 max-w-2xl">
      {STEPS.map((s, i) => {
        const state: "done" | "active" | "todo" = i < activeIdx ? "done" : i === activeIdx ? "active" : "todo"
        const Icon = s.Icon
        return (
          <li key={s.id} className="flex items-center gap-1 md:gap-2 flex-1 last:flex-none">
            <div className="flex items-center gap-2 shrink-0">
              <span
                className={`relative inline-flex w-7 h-7 md:w-8 md:h-8 items-center justify-center rounded-full text-[11px] font-semibold transition-all duration-300 ${
                  state === "done"
                    ? "bg-green-500 text-white"
                    : state === "active"
                    ? "bg-navy text-white ring-4 ring-navy/15"
                    : "bg-paper border border-line text-ink-3"
                }`}
              >
                {state === "done" ? <Check size={13} strokeWidth={3} /> : <Icon size={13} />}
              </span>
              <span
                className={`hidden sm:block text-[13px] font-medium tracking-tight ${
                  state === "active" ? "text-ink" : state === "done" ? "text-ink-2" : "text-ink-3"
                }`}
              >
                {s.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <span className="flex-1 h-px bg-line relative overflow-hidden">
                <span
                  className={`absolute inset-y-0 left-0 bg-green-500 transition-all duration-500 ${
                    state === "done" ? "right-0" : "right-full"
                  }`}
                />
              </span>
            )}
          </li>
        )
      })}
    </ol>
  )
}
