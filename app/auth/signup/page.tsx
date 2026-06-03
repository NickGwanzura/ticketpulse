import { signIn } from "@/auth"
import Link from "next/link"
import { Check, User, CalendarCog, Store, Mail, ArrowRight } from "lucide-react"
import PasswordInput from "@/components/PasswordInput"

const ROLES = [
  { value: "attendee",  label: "Attendee",  body: "Buy tickets, book shuttles, grab merch and photo packs.",   icon: User },
  { value: "organizer", label: "Organizer", body: "Sell out events. Manage tickets, merch, transport, vendors.", icon: CalendarCog },
  { value: "vendor",    label: "Vendor",    body: "List your service, take bookings from event organizers.",    icon: Store },
] as const

function localCallback(value: string | undefined): string | null {
  return value?.startsWith("/") && !value.startsWith("//") ? value : null
}

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string; callbackUrl?: string }>
}) {
  const sp = await searchParams
  const roleValues = ROLES.map((role) => role.value)
  const initialRole = roleValues.includes(sp.role as typeof roleValues[number])
    ? (sp.role as typeof roleValues[number])
    : "attendee"
  const callbackUrl = localCallback(sp.callbackUrl)

  return (
    <div
      className="relative min-h-[calc(100vh-4rem)] px-4 py-10 md:py-16"
      style={{
        background:
          "radial-gradient(800px 400px at 80% -10%, #DBE8FB 0%, transparent 55%), radial-gradient(600px 300px at 0% 100%, rgba(254,235,200,0.4) 0%, transparent 55%), linear-gradient(180deg, #F6F9FC 0%, #FFFFFF 100%)",
      }}>
      <div className="max-w-md mx-auto">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 font-bold text-xl tracking-tight text-ink">
            <span className="relative inline-flex w-6 h-6 items-center justify-center rounded-md bg-navy">
              <span className="block w-1.5 h-1.5 rounded-full bg-white" />
            </span>
            TicketPulse
          </Link>
          <h1 className="mt-6 text-[24px] md:text-[28px] font-bold tracking-tight text-ink">Create your account</h1>
          <p className="text-[14px] text-ink mt-1.5">Free forever for attendees. Pay-as-you-sell for organizers.</p>
        </div>

        <form
          action={async (formData: FormData) => {
            "use server"
            const { db } = await import("@/db")
            const { users } = await import("@/db/schema")
            const { eq } = await import("drizzle-orm")
            const { hashPassword } = await import("@/lib/password")

            const ALLOWED_SIGNUP_ROLES = ["attendee", "organizer", "vendor"] as const
            type AllowedRole = typeof ALLOWED_SIGNUP_ROLES[number]
            const rawRole = formData.get("role")
            const role: AllowedRole = ALLOWED_SIGNUP_ROLES.includes(rawRole as AllowedRole)
              ? (rawRole as AllowedRole)
              : "attendee"
            const email = ((formData.get("email") as string) ?? "").toLowerCase().trim()
            const password = (formData.get("password") as string) ?? ""
            const name  = ((formData.get("name") as string) ?? "").trim() || null
            if (!email || password.length < 8) return

            const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1)
            let finalRole: AllowedRole | "admin" = role
            if (!existing) {
              await db.insert(users).values({
                email,
                name,
                role,
                passwordHash: hashPassword(password),
              })

              // Fire-and-forget welcome email — signup must not fail if mail fails.
              const { sendWelcomeEmail, adminEmail } = await import("@/lib/email")
              sendWelcomeEmail({ to: email, name }).catch((e) => console.error("welcome email", e))

              // Notify the admin of the new signup (fire-and-forget).
              const { sendEmail } = await import("@/lib/email")
              const { newSignupAdminNotification } = await import("@/lib/email-templates")
              const adminNotice = newSignupAdminNotification({ name, email, role })
              sendEmail({
                to: adminEmail,
                subject: `New signup: ${email} (${role})`,
                html: adminNotice.html,
                text: adminNotice.text,
              }).catch((e) => console.error("admin signup notification", e))

              // WhatsApp alert to admin (fire-and-forget).
              const { sendAdminAlert } = await import("@/lib/whatsapp")
              sendAdminAlert(
                `🆕 *New signup — ${role}*\n\nName: ${name ?? "—"}\nEmail: ${email}\nRole: ${role}\n\nView in admin: ${process.env.NEXT_PUBLIC_APP_URL ?? "https://ticketpulse.tech"}/admin/users`,
              ).catch((e) => console.error("admin signup WhatsApp alert", e))
            } else {
              finalRole = existing.role ?? "attendee"
              const updates: Partial<typeof users.$inferInsert> = {}

              if (!existing.passwordHash) {
                updates.passwordHash = hashPassword(password)
              }
              if (!existing.name && name) {
                updates.name = name
              }
              if (existing.role === "attendee" && role !== "attendee") {
                updates.role = role
                finalRole = role
              }

              if (Object.keys(updates).length > 0) {
                await db.update(users).set({ ...updates, updatedAt: new Date() }).where(eq(users.id, existing.id))
              }
            }

            await signIn("credentials", {
              email,
              password,
              redirectTo: callbackUrl ?? (finalRole === "organizer" ? "/organizer" : finalRole === "vendor" ? "/vendors/apply" : "/dashboard"),
            })
          }}
          className="rounded-2xl border border-line-2 bg-paper p-6 shadow-md shadow-navy/[0.04] space-y-5"
        >
          <div>
            <p className="text-[11px] font-semibold tracking-[0.18em] text-ink-2 uppercase mb-2.5">I&apos;m signing up as</p>
            <div className="grid grid-cols-3 gap-2">
              {ROLES.map(({ value, label, body, icon: Icon }) => (
                <label
                  key={value}
                  className="relative cursor-pointer rounded-xl border border-line-2 bg-paper p-3 text-center hover:border-line-2 transition-colors has-[:checked]:border-navy has-[:checked]:bg-green-50 has-[:checked]:ring-1 has-[:checked]:ring-navy/15"
                >
                  <input
                    type="radio"
                    name="role"
                    value={value}
                    defaultChecked={initialRole === value}
                    className="sr-only peer"
                  />
                  <Icon size={16} className="mx-auto text-ink-2 peer-checked:text-navy mb-1.5" />
                  <span className="block text-[13px] font-semibold text-ink">{label}</span>
                  <span className="block text-[10px] text-ink-3 mt-0.5 leading-tight">{body}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[13px] font-medium text-ink mb-2">Full name</label>
            <div className="relative">
              <User size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-2" />
              <input
                type="text"
                name="name"
                required
                autoComplete="name"
                placeholder="Tendai Moyo"
                className="w-full bg-paper border border-line-2 rounded-xl pl-10 pr-4 py-3.5 text-[15px] text-ink placeholder:text-ink-2 focus:outline-none focus:border-green-500 focus:ring-4 focus:ring-brand-500/10 transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-[13px] font-medium text-ink mb-2">Email address</label>
            <div className="relative">
              <Mail size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-2" />
              <input
                type="email"
                name="email"
                required
                autoComplete="email"
                inputMode="email"
                placeholder="you@example.com"
                className="w-full bg-paper border border-line-2 rounded-xl pl-10 pr-4 py-3.5 text-[15px] text-ink placeholder:text-ink-2 focus:outline-none focus:border-green-500 focus:ring-4 focus:ring-brand-500/10 transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-[13px] font-medium text-ink mb-2">Password</label>
            <PasswordInput
              autoComplete="new-password"
              placeholder="At least 8 characters"
            />
          </div>

          <button
            type="submit"
            className="w-full inline-flex items-center justify-center gap-2 bg-brand-600 text-white font-semibold text-[15px] py-3.5 rounded-xl hover:bg-brand-700 active:scale-[0.99] transition shadow-md shadow-brand-600/25"
          >
            Create account <ArrowRight size={15} />
          </button>

          <p className="text-[12px] text-ink-2 text-center leading-relaxed">
            By continuing you agree to the{" "}
            <Link href="/legal/terms" className="text-navy font-semibold hover:underline">Terms</Link>{" "}
            and{" "}
            <Link href="/legal/privacy" className="text-navy font-semibold hover:underline">Privacy Policy</Link>.
          </p>
        </form>

        <div className="my-5 flex items-center gap-3">
          <div className="flex-1 h-px bg-line-2" />
          <span className="text-[11px] font-semibold text-ink-2 uppercase tracking-widest">or</span>
          <div className="flex-1 h-px bg-line-2" />
        </div>

        <form
          action={async () => {
            "use server"
            const params = new URLSearchParams({ role: initialRole })
            if (callbackUrl) params.set("callbackUrl", callbackUrl)
            const redirectTo = `/auth/complete-signup?${params.toString()}`
            await signIn("google", { redirectTo })
          }}
        >
          <button
            type="submit"
            className="w-full flex items-center justify-center gap-3 border border-line-2 bg-paper text-ink font-medium text-[14px] py-3.5 rounded-xl hover:bg-paper-2 hover:border-line-2 transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </button>
        </form>

        <p className="text-center text-[13px] text-ink-2 mt-6">
          Already have an account?{" "}
          <Link href="/auth/signin" className="font-semibold text-navy hover:underline">Sign in</Link>
        </p>

        <ul className="mt-8 space-y-2.5">
          {[
            "Mobile QR ticket entry",
            "Pay with EcoCash or Visa",
            "Cancel & refund up to 24hrs before",
          ].map((p) => (
            <li key={p} className="flex items-center gap-2 text-[13px] text-ink-2">
              <Check size={14} className="text-brand-600" /> {p}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
