import { signIn } from "@/auth"
import { isValidWhatsappContact } from "@/lib/phone"
import Link from "next/link"
import Logo from "@/components/ui/Logo"
import { Check, User, CalendarCog, Store, Mail, ArrowRight, Ticket, QrCode, Wallet, BarChart3, MessageSquare, Zap, Smartphone } from "lucide-react"
import PasswordInput from "@/components/PasswordInput"
import GoogleSignupForm from "./GoogleSignupForm"
import { redirect } from "next/navigation"
import { getDashboardPathForRole } from "@/lib/role-routes"
import Script from "next/script"

const ROLES = [
  { value: "attendee",  label: "Attendee",  body: "Buy tickets, grab merch and photo packs.",   icon: User },
  { value: "organizer", label: "Organizer", body: "Sell out events. Manage tickets, merch, vendors, and payouts.", icon: CalendarCog },
  { value: "vendor",    label: "Vendor",    body: "List your service and receive booking requests from event organizers.",    icon: Store },
] as const

function localCallback(value: string | undefined): string | null {
  return value?.startsWith("/") && !value.startsWith("//") ? value : null
}

const SIGNUP_ERRORS: Record<string, string> = {
  invalid: "Please enter your name, email address, and a password with at least 8 characters.",
  whatsapp_required: "Organizer accounts must include a valid WhatsApp contact number.",
  account_exists: "An account already exists for this email. Sign in with the same password, or use Forgot password.",
  password_required: "This account was created with Google. Use Continue with Google, or set a password with Forgot password.",
  too_many: "Too many signup attempts. Please wait before trying again.",
  challenge: "Please complete the security check and try again.",
}

function signupUrl(role: string, callbackUrl: string | null, error: keyof typeof SIGNUP_ERRORS, email?: string, name?: string, phone?: string) {
  const params = new URLSearchParams({ role, error })
  if (callbackUrl) params.set("callbackUrl", callbackUrl)
  if (email) params.set("email", email)
  if (name) params.set("name", name)
  if (phone) params.set("phone", phone)
  return `/auth/signup?${params.toString()}`
}

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string; callbackUrl?: string; error?: string; email?: string; name?: string; phone?: string }>
}) {
  const sp = await searchParams
  const roleValues = ROLES.map((role) => role.value)
  const initialRole = roleValues.includes(sp.role as typeof roleValues[number])
    ? (sp.role as typeof roleValues[number])
    : "attendee"
  const callbackUrl = localCallback(sp.callbackUrl)
  const errorMessage = sp.error ? SIGNUP_ERRORS[sp.error] : null
  const defaultEmail = sp.email?.toLowerCase().trim() ?? ""
  const defaultName = sp.name?.trim() ?? ""
  const defaultPhone = sp.phone?.trim() ?? ""

  const FEATURE_HIGHLIGHTS = [
    { icon: Ticket,       label: "Sell tickets in minutes",   body: "Set up your event, add tiers, and go live — no tech skills needed." },
    { icon: QrCode,       label: "Mobile QR scanning",        body: "Scan tickets at the door with any phone. No hardware required." },
    { icon: Wallet,       label: "EcoCash & card payments",   body: "Accept EcoCash, Visa, and Mastercard out of the box." },
    { icon: BarChart3,    label: "Real-time analytics",       body: "See sales, capacity, and revenue update live as tickets sell." },
    { icon: MessageSquare, label: "WhatsApp & email comms",  body: "Send blast messages and updates directly to your attendees." },
    { icon: Zap,          label: "Fast payouts",              body: "Request your earnings any time. Processed within 24 hours." },
  ]

  return (
    <div
      className="relative min-h-[calc(100vh-4rem)] px-4 py-10 md:py-16 tp-auth-wash">
      <div className="max-w-5xl mx-auto lg:grid lg:grid-cols-[1fr_448px] lg:gap-16 lg:items-start">

        {/* ── Feature highlights panel (desktop only) ── */}
        <div className="hidden lg:flex flex-col pt-4 sticky top-24">
          <Link href="/" className="inline-flex items-center mb-10" aria-label="TicketPulse home">
            <Logo className="h-14 w-auto" />
          </Link>
          <p className="text-[11px] font-semibold tracking-[0.18em] text-blue uppercase mb-3">Built for Zimbabwe</p>
          <h2 className="text-[28px] font-bold tracking-tight text-ink leading-snug mb-2">
            Everything you need to run a great event
          </h2>
          <p className="text-[14px] text-ink-2 mb-8">
            From draft to sold-out in minutes. Join organizers who&apos;ve sold thousands of tickets on TicketPulse.
          </p>
          <div className="space-y-4">
            {FEATURE_HIGHLIGHTS.map(({ icon: Icon, label, body }) => (
              <div key={label} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-navy/8 text-navy">
                  <Icon size={15} />
                </span>
                <div>
                  <p className="text-[13px] font-semibold text-ink">{label}</p>
                  <p className="text-[12px] text-ink-3 mt-0.5">{body}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-10 rounded-xl border border-line bg-paper p-4">
            <p className="text-[12px] text-ink-2 leading-relaxed">
              &ldquo;We sold out 400 tickets in under 3 days. TicketPulse made it simple.&rdquo;
            </p>
            <p className="mt-2 text-[11px] font-semibold text-ink-3">— Event organizer, Harare</p>
          </div>
        </div>

        {/* ── Sign-up form ── */}
        <div className="max-w-md mx-auto lg:mx-0 lg:max-w-none">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center justify-center" aria-label="TicketPulse home">
            <Logo className="h-14 w-auto" />
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
            const { hashPassword, verifyPassword } = await import("@/lib/password")
            const ALLOWED_SIGNUP_ROLES = ["attendee", "organizer", "vendor"] as const
            type AllowedRole = typeof ALLOWED_SIGNUP_ROLES[number]
            const rawRole = formData.get("role")
            const role: AllowedRole = ALLOWED_SIGNUP_ROLES.includes(rawRole as AllowedRole)
              ? (rawRole as AllowedRole)
              : "attendee"
            const requestedCallbackUrl = localCallback((formData.get("callbackUrl") as string) ?? undefined)
            const email = ((formData.get("email") as string) ?? "").toLowerCase().trim()
            const password = (formData.get("password") as string) ?? ""
            const name  = ((formData.get("name") as string) ?? "").trim() || null
            const whatsappContact = ((formData.get("whatsappContact") as string) ?? "").trim()
            if (!email || password.length < 8 || !name) {
              redirect(signupUrl(role, requestedCallbackUrl, "invalid", email, name ?? undefined, whatsappContact))
            }
            if (role === "organizer" && !isValidWhatsappContact(whatsappContact)) {
              redirect(signupUrl(role, requestedCallbackUrl, "whatsapp_required", email, name ?? undefined, whatsappContact))
            }

            // A filled trap field is a bot submission. Do not create an account.
            if (formData.get("companyWebsite")) {
              redirect(signupUrl(role, requestedCallbackUrl, "invalid"))
            }

            const { allowSignupAttempt, verifySignupChallenge } = await import("@/lib/signup-protection")
            const headersList = await import("next/headers")
            const hdrs = (await headersList.headers())
            const ip = hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"
            if (!await allowSignupAttempt(ip, email)) {
              redirect(signupUrl(role, requestedCallbackUrl, "too_many", email, name ?? undefined))
            }
            if ((process.env.TURNSTILE_SECRET_KEY || process.env.TURNSTILE_SITE_KEY) &&
                !await verifySignupChallenge(String(formData.get("cf-turnstile-response") ?? ""), ip)) {
              redirect(signupUrl(role, requestedCallbackUrl, "challenge", email, name ?? undefined, whatsappContact))
            }

            const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1)
            let finalRole: string = role
            if (!existing) {
              await db.insert(users).values({
                email,
                name,
                role,
                phone: role === "organizer" ? whatsappContact : undefined,
                passwordHash: hashPassword(password),
              })

              // Fire-and-forget welcome email — signup must not fail if mail fails.
              const { sendWelcomeEmail } = await import("@/lib/email")
              const { log: logger } = await import("@/lib/logger")
              sendWelcomeEmail({ to: email, name }).catch((e) => {
                console.error("welcome email", e)
                logger.error("signup — welcome email failed", { email, error: String(e) })
              })

              // If the user signed up as an organiser, send an email-verification
              // link. The organiser dashboard is gated behind emailVerified.
              if (role === "organizer") {
                const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://ticketpulse.tech"
                const { generateVerificationToken, VERIFICATION_TOKEN_EXPIRY_HOURS } = await import("@/lib/email-verification")
                const { emailVerificationTokens } = await import("@/db/schema")
                const { sendEmailVerificationEmail } = await import("@/lib/email")

                const tokenInfo = generateVerificationToken()
                const expiresAt = new Date(Date.now() + VERIFICATION_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000)
                // Re-fetch the new user's id since the insert above didn't return it.
                const [newUser] = await db
                  .select({ id: users.id })
                  .from(users)
                  .where(eq(users.email, email))
                  .limit(1)

                if (newUser) {
                  const { trackOrganizerLifecycle } = await import("@/lib/organizer-lifecycle")
                  await trackOrganizerLifecycle({
                    step: "SIGNUP_COMPLETED",
                    organizerId: newUser.id,
                    dedupeKey: `organizer:${newUser.id}:signup-completed`,
                    source: "web_signup",
                  })

                  await db.insert(emailVerificationTokens).values({
                    userId: newUser.id,
                    tokenHash: tokenInfo.hash,
                    expiresAt,
                  })

                  const verifyUrl = `${APP_URL}/api/auth/verify-email/${tokenInfo.raw}`
                  sendEmailVerificationEmail({ to: email, name, url: verifyUrl }).catch((e) => {
                    console.error("signup — verification email", e)
                    logger.error("signup — verification email failed", { email, error: String(e) })
                  })
                }
              }
            } else {
              finalRole = existing.role ?? "attendee"
              const updates: Partial<typeof users.$inferInsert> = {}

              if (!existing.passwordHash) {
                redirect(signupUrl(role, requestedCallbackUrl, "password_required", email, name ?? undefined))
              } else if (!verifyPassword(password, existing.passwordHash)) {
                redirect(signupUrl(role, requestedCallbackUrl, "account_exists", email, name ?? undefined))
              }
              if (!existing.name && name) {
                updates.name = name
              }
              if (existing.role === "attendee" && role !== "attendee") {
                updates.role = role
                finalRole = role
              }
              if (role === "organizer") {
                updates.phone = whatsappContact
              }

              if (Object.keys(updates).length > 0) {
                await db.update(users).set({ ...updates, updatedAt: new Date() }).where(eq(users.id, existing.id))
              }
            }

            await signIn("credentials", {
              email,
              password,
              redirectTo: requestedCallbackUrl ?? (finalRole === "vendor" ? "/vendors/apply" : getDashboardPathForRole(finalRole)),
            })
          }}
          className="rounded-2xl border border-line-2 bg-paper p-6 shadow-md shadow-navy/[0.04] space-y-5"
        >
          {errorMessage && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] font-medium text-rose-700">
              {errorMessage}{" "}
              <Link
                href={`/auth/signin?email=${encodeURIComponent(defaultEmail)}${callbackUrl ? `&callbackUrl=${encodeURIComponent(callbackUrl)}` : ""}`}
                className="font-semibold underline underline-offset-2"
              >
                Sign in
              </Link>
            </div>
          )}

          {callbackUrl && <input type="hidden" name="callbackUrl" value={callbackUrl} />}

          <div className="absolute -left-[10000px]" aria-hidden="true">
            <label htmlFor="companyWebsite">Company website</label>
            <input id="companyWebsite" name="companyWebsite" type="text" autoComplete="off" tabIndex={-1} />
          </div>

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
                  <Icon size={16} className="mx-auto text-ink-2 peer-checked:text-link mb-1.5" />
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
                defaultValue={defaultName}
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
                defaultValue={defaultEmail}
                className="w-full bg-paper border border-line-2 rounded-xl pl-10 pr-4 py-3.5 text-[15px] text-ink placeholder:text-ink-2 focus:outline-none focus:border-green-500 focus:ring-4 focus:ring-brand-500/10 transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-[13px] font-medium text-ink mb-2">
              Organizer WhatsApp contact <span className="text-ink-3 font-normal">(required for organizers)</span>
            </label>
            <div className="relative">
              <Smartphone size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-2" />
              <input
                type="tel"
                name="whatsappContact"
                autoComplete="tel"
                inputMode="tel"
                placeholder="+263 77 123 4567"
                defaultValue={defaultPhone}
                className="w-full bg-paper border border-line-2 rounded-xl pl-10 pr-4 py-3.5 text-[15px] text-ink placeholder:text-ink-2 focus:outline-none focus:border-green-500 focus:ring-4 focus:ring-brand-500/10 transition"
              />
            </div>
            <p className="mt-1.5 text-[11px] text-ink-3">
              Used for urgent ticket, payout, event approval, and buyer-support issues.
            </p>
          </div>

          <div>
            <label className="block text-[13px] font-medium text-ink mb-2">Password</label>
            <PasswordInput
              autoComplete="new-password"
              placeholder="At least 8 characters"
            />
          </div>

          {process.env.TURNSTILE_SITE_KEY && (
            <>
              <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" strategy="afterInteractive" />
              <div className="cf-turnstile" data-sitekey={process.env.TURNSTILE_SITE_KEY} data-theme="auto" />
            </>
          )}

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

        <GoogleSignupForm
          action={async (formData: FormData) => {
            "use server"
            const role = (formData.get("role") as string) || "attendee"
            const requestedCallbackUrl = localCallback((formData.get("callbackUrl") as string) ?? undefined)
            const params = new URLSearchParams({ role })
            if (requestedCallbackUrl) params.set("callbackUrl", requestedCallbackUrl)
            const redirectTo = `/auth/complete-signup?${params.toString()}`
            await signIn("google", { redirectTo })
          }}
          initialRole={initialRole}
          callbackUrl={callbackUrl}
        />

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
        </div>{/* end form wrapper */}
      </div>{/* end grid container */}
    </div>
  )
}
