import { auth, signOut } from "@/auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import { ArrowUpRight, Bell, CreditCard, Globe, Lock, Mail, Phone, ShieldCheck, User, LogOut } from "lucide-react"

const SECTIONS = [
  { href: "#profile",       label: "Profile",       icon: User,         body: "Name, email, phone" },
  { href: "#payments",      label: "Payments",      icon: CreditCard,   body: "EcoCash, cards, payouts" },
  { href: "#preferences",   label: "Preferences",   icon: Bell,         body: "Notifications, language" },
  { href: "#security",      label: "Security",      icon: Lock,         body: "Sessions, 2FA" },
]

export default async function AccountPage() {
  const session = await auth()
  if (!session) redirect("/auth/signin")
  const user = session.user

  return (
    <div>
      <div className="border-b border-line bg-paper-2">
        <div className="max-w-5xl mx-auto px-5 md:px-8 py-10 md:py-14">
          <p className="text-[11px] font-semibold tracking-[0.18em] text-blue uppercase mb-2">Account</p>
          <h1 className="text-[32px] md:text-[40px] font-bold tracking-tight leading-tight text-ink">
            {user.name ?? "Your account"}
          </h1>
          <p className="mt-1.5 text-[14.5px] text-ink-2">{user.email}</p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-5 md:px-8 py-10">
        {/* Quick nav */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-10">
          {SECTIONS.map(({ href, label, icon: Icon, body }) => (
            <Link
              key={label}
              href={href}
              className="rounded-2xl border border-line bg-paper p-5 hover:border-line-2 hover:shadow-sm transition-all group"
            >
              <Icon size={16} className="text-blue mb-3" />
              <p className="text-[14px] font-semibold tracking-tight text-ink">{label}</p>
              <p className="text-[12px] text-ink-3 mt-0.5">{body}</p>
            </Link>
          ))}
        </div>

        {/* Profile */}
        <section id="profile" className="mb-12 scroll-mt-24">
          <p className="text-[11px] font-semibold tracking-[0.18em] text-blue uppercase mb-2">Profile</p>
          <h2 className="text-[22px] font-bold tracking-tight text-ink mb-5">Personal information</h2>

          <form className="rounded-2xl border border-line bg-paper p-6 md:p-7 space-y-5">
            <div className="flex items-center gap-4">
              <div className="inline-flex w-14 h-14 items-center justify-center rounded-2xl bg-navy text-white text-[18px] font-semibold">
                {(user.name?.[0] ?? user.email?.[0] ?? "U").toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[14.5px] font-semibold tracking-tight text-ink">{user.name ?? "Add your name"}</p>
                <p className="text-[12.5px] text-ink-3 truncate">{user.email}</p>
              </div>
              <button type="button" className="text-[12.5px] font-semibold text-navy hover:underline shrink-0">Change photo</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="block text-[11.5px] font-medium text-ink-2 mb-1.5">Full name</label>
                <input
                  type="text"
                  defaultValue={user.name ?? ""}
                  className="w-full bg-paper border border-line rounded-xl px-4 py-3 text-sm text-ink focus:outline-none focus:border-blue focus:ring-4 focus:ring-blue/10 transition"
                />
              </div>
              <div>
                <label className="block text-[11.5px] font-medium text-ink-2 mb-1.5">Email</label>
                <div className="relative">
                  <Mail size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-3" />
                  <input
                    type="email"
                    defaultValue={user.email ?? ""}
                    className="w-full bg-paper-2 border border-line rounded-xl pl-10 pr-4 py-3 text-sm text-ink-2"
                    readOnly
                  />
                </div>
              </div>
              <div>
                <label className="block text-[11.5px] font-medium text-ink-2 mb-1.5">Phone</label>
                <div className="relative">
                  <Phone size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-3" />
                  <input
                    type="tel"
                    placeholder="+263 77…"
                    className="w-full bg-paper border border-line rounded-xl pl-10 pr-4 py-3 text-sm text-ink placeholder:text-ink-3 focus:outline-none focus:border-blue focus:ring-4 focus:ring-blue/10 transition"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[11.5px] font-medium text-ink-2 mb-1.5">City</label>
                <input
                  type="text"
                  placeholder="Harare"
                  className="w-full bg-paper border border-line rounded-xl px-4 py-3 text-sm text-ink placeholder:text-ink-3 focus:outline-none focus:border-blue focus:ring-4 focus:ring-blue/10 transition"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button type="reset" className="text-sm font-medium text-ink-2 hover:text-ink px-3 py-2">Cancel</button>
              <button type="submit" className="rounded-xl bg-navy text-white text-sm font-semibold px-4 py-2.5 hover:bg-navy-700 transition-colors shadow-sm shadow-navy/20">Save changes</button>
            </div>
          </form>
        </section>

        {/* Payments */}
        <section id="payments" className="mb-12 scroll-mt-24">
          <p className="text-[11px] font-semibold tracking-[0.18em] text-blue uppercase mb-2">Payments</p>
          <h2 className="text-[22px] font-bold tracking-tight text-ink mb-5">Methods &amp; payouts</h2>

          <div className="rounded-2xl border border-line bg-paper p-6">
            <p className="text-sm font-semibold text-ink mb-1">No payment methods yet</p>
            <p className="text-[13px] text-ink-2 mb-5">Add EcoCash or a card to skip checkout next time.</p>
            <button className="rounded-xl bg-navy text-white text-sm font-semibold px-4 py-2.5 hover:bg-navy-700 transition-colors">
              Add a method
            </button>
          </div>
        </section>

        {/* Preferences */}
        <section id="preferences" className="mb-12 scroll-mt-24">
          <p className="text-[11px] font-semibold tracking-[0.18em] text-blue uppercase mb-2">Preferences</p>
          <h2 className="text-[22px] font-bold tracking-tight text-ink mb-5">Notifications &amp; language</h2>

          <div className="rounded-2xl border border-line bg-paper divide-y divide-line">
            {[
              { title: "New events near me",   body: "Email + push when relevant events go on sale." },
              { title: "Order receipts",       body: "Email confirmations for every purchase." },
              { title: "Marketing & offers",   body: "Hand-picked features. We won't spam." },
            ].map((p, i) => (
              <label key={p.title} className="flex items-start gap-4 p-5 cursor-pointer">
                <div className="flex-1">
                  <p className="text-[14px] font-semibold tracking-tight text-ink">{p.title}</p>
                  <p className="text-[12.5px] text-ink-2 mt-0.5">{p.body}</p>
                </div>
                <input type="checkbox" defaultChecked={i < 2} className="mt-1.5 w-4 h-4 accent-navy" />
              </label>
            ))}
          </div>

          <div className="mt-4 rounded-2xl border border-line bg-paper p-5 flex items-center gap-3">
            <Globe size={16} className="text-ink-3" />
            <span className="text-[13.5px] font-medium text-ink flex-1">Language &amp; region</span>
            <select className="bg-paper-2 border border-line rounded-lg px-3 py-1.5 text-[13px] text-ink">
              <option>English (Zimbabwe)</option>
              <option>English (UK)</option>
              <option>Shona</option>
              <option>Ndebele</option>
            </select>
          </div>
        </section>

        {/* Security */}
        <section id="security" className="mb-4 scroll-mt-24">
          <p className="text-[11px] font-semibold tracking-[0.18em] text-blue uppercase mb-2">Security</p>
          <h2 className="text-[22px] font-bold tracking-tight text-ink mb-5">Account &amp; sessions</h2>

          <div className="rounded-2xl border border-line bg-paper divide-y divide-line">
            <div className="flex items-start gap-4 p-5">
              <ShieldCheck size={16} className="text-emerald-600 mt-0.5" />
              <div className="flex-1">
                <p className="text-[14px] font-semibold tracking-tight text-ink">Two-factor authentication</p>
                <p className="text-[12.5px] text-ink-2 mt-0.5">Extra layer of security on sign-in.</p>
              </div>
              <button className="text-[13px] font-semibold text-navy hover:underline">Set up</button>
            </div>
            <div className="flex items-start gap-4 p-5">
              <Lock size={16} className="text-ink-3 mt-0.5" />
              <div className="flex-1">
                <p className="text-[14px] font-semibold tracking-tight text-ink">Active sessions</p>
                <p className="text-[12.5px] text-ink-2 mt-0.5">1 device, this browser. Sign out everywhere if you suspect access.</p>
              </div>
              <form
                action={async () => {
                  "use server"
                  await signOut({ redirectTo: "/?signedOut=1" })
                }}
              >
                <button type="submit" className="text-[13px] font-semibold text-rose-600 hover:underline">
                  Sign out everywhere
                </button>
              </form>
            </div>
            <div className="flex items-start gap-4 p-5">
              <LogOut size={16} className="text-ink-3 mt-0.5" />
              <div className="flex-1">
                <p className="text-[14px] font-semibold tracking-tight text-ink">Sign out of this browser</p>
                <p className="text-[12.5px] text-ink-2 mt-0.5">End your current session, your tickets stay in your account.</p>
              </div>
              <Link
                href="/logout"
                className="text-[13px] font-semibold text-navy hover:underline inline-flex items-center gap-1"
              >
                Sign out <ArrowUpRight size={12} />
              </Link>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-rose-200/60 bg-rose-50/40 p-5 flex items-start gap-3">
            <p className="flex-1 text-[13px] text-ink-2">
              <span className="font-semibold text-rose-700">Delete account</span>, permanently remove your account and bookings. This can&apos;t be undone.
            </p>
            <button className="text-[12.5px] font-semibold text-rose-700 hover:underline shrink-0">Delete</button>
          </div>
        </section>

        <div className="mt-10">
          <Link href="/dashboard" className="inline-flex items-center gap-1 text-sm font-semibold text-navy hover:gap-1.5 transition-all">
            Back to dashboard <ArrowUpRight size={13} />
          </Link>
        </div>
      </div>
    </div>
  )
}
