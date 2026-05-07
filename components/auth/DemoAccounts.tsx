import { signIn } from "@/auth"
import { User, CalendarCog, Store, ArrowRight, Sparkles, Copy } from "lucide-react"

const DEMO = [
  {
    role: "attendee" as const,
    label: "Attendee",
    body: "Buy tickets, browse events.",
    email: "demo@ticketpulse.zw",
    password: "demo1234",
    redirect: "/dashboard",
    icon: User,
    accent: "text-blue",
  },
  {
    role: "organizer" as const,
    label: "Organizer",
    body: "Manage events, payouts, scans.",
    email: "organizer@ticketpulse.zw",
    password: "demo1234",
    redirect: "/organizer",
    icon: CalendarCog,
    accent: "text-violet-600",
  },
  {
    role: "vendor" as const,
    label: "Vendor",
    body: "View bookings & profile.",
    email: "vendor@ticketpulse.zw",
    password: "demo1234",
    redirect: "/vendors",
    icon: Store,
    accent: "text-emerald-600",
  },
]

export default function DemoAccounts() {
  return (
    <div className="rounded-2xl border border-blue/15 bg-gradient-to-br from-blue-soft/70 via-paper to-paper p-5 shadow-sm shadow-ink/[0.03]">
      <div className="flex items-center gap-2 mb-1">
        <Sparkles size={13} className="text-blue" />
        <p className="text-[11px] font-semibold tracking-[0.18em] text-blue uppercase">Try the demo</p>
      </div>
      <p className="text-[12.5px] text-ink-2 mb-4 leading-relaxed">
        One-click sign-in. Password is <span className="font-mono font-semibold text-ink">demo1234</span> for every account.
      </p>

      <div className="space-y-2">
        {DEMO.map((d) => (
          <form
            key={d.role}
            action={async () => {
              "use server"
              await signIn("credentials", {
                email: d.email,
                password: d.password,
                redirectTo: d.redirect,
              })
            }}
          >
            <button
              type="submit"
              className="group w-full flex items-center gap-3 rounded-xl border border-line bg-paper p-3 text-left hover:border-line-2 hover:shadow-sm transition-all"
            >
              <span className="shrink-0 inline-flex w-9 h-9 items-center justify-center rounded-lg bg-paper-2 ring-1 ring-line">
                <d.icon size={15} className={d.accent} />
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-[13px] font-semibold tracking-tight text-ink">{d.label}</p>
                  <span className="text-[10px] font-mono text-ink-3 truncate">{d.email}</span>
                </div>
                <p className="text-[11.5px] text-ink-2 line-clamp-1">{d.body}</p>
              </div>
              <span className="shrink-0 inline-flex items-center gap-1 rounded-md bg-paper-2 ring-1 ring-line px-2 py-1 text-[10.5px] font-semibold text-navy group-hover:bg-navy group-hover:text-white group-hover:ring-navy transition-colors">
                Try <ArrowRight size={11} />
              </span>
            </button>
          </form>
        ))}
      </div>

      <p className="mt-3.5 text-[11px] text-ink-3 inline-flex items-center gap-1.5">
        <Copy size={11} /> Or use the form above with any of these emails.
      </p>
    </div>
  )
}
