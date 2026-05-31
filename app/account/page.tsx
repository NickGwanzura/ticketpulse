import { auth, signOut } from "@/auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import { ArrowUpRight, Bell, CreditCard, Globe, Lock, ShieldCheck, Store, User, LogOut } from "lucide-react"
import { eq, sql } from "drizzle-orm"
import { db } from "@/db"
import { users, vendors } from "@/db/schema"
import AccountForm from "./AccountForm"

const SECTIONS = [
  { href: "#profile",       label: "Profile",       icon: User,         body: "Name, email, phone" },
  { href: "#payments",      label: "Payments",      icon: CreditCard,   body: "EcoCash, cards, payouts" },
  { href: "#preferences",   label: "Preferences",   icon: Bell,         body: "Notifications, language" },
  { href: "#security",      label: "Security",      icon: Lock,         body: "Sessions, 2FA" },
]

export default async function AccountPage() {
  const session = await auth()
  if (!session) redirect("/auth/signin")
  const sessionUser = session.user

  const [dbUser] = await db
    .select({ phone: users.phone, bio: users.bio })
    .from(users)
    .where(eq(users.id, sessionUser.id))
    .limit(1)

  const [vendorCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(vendors)
    .where(eq(vendors.userId, sessionUser.id))
  const hasVendor = (vendorCount?.count ?? 0) > 0

  const user = {
    ...sessionUser,
    phone: dbUser?.phone ?? null,
    bio:   dbUser?.bio   ?? null,
  }

  return (
    <div>
      <div className="border-b border-line bg-paper-2">
        <div className="max-w-5xl mx-auto px-5 md:px-8 py-10 md:py-14">
          <p className="text-[11px] font-semibold tracking-[0.18em] text-blue uppercase mb-2">Account</p>
          <h1 className="text-[32px] md:text-[40px] font-bold tracking-tight leading-tight text-ink">
            {user.name ?? "Your account"}
          </h1>
          <p className="mt-1.5 text-[15px] text-ink-2">{user.email}</p>
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

        {hasVendor && (
          <Link
            href="/vendors/dashboard"
            className="group mb-10 flex items-center gap-4 rounded-2xl border border-line bg-paper p-5 hover:border-line-2 hover:shadow-sm transition-all"
          >
            <span className="inline-flex w-10 h-10 items-center justify-center rounded-xl bg-green-50 ring-1 ring-green-500/15">
              <Store size={16} className="text-brand-600" />
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-semibold tracking-tight text-ink">Vendor dashboard</p>
              <p className="text-[13px] text-ink-2 mt-0.5">Edit your business profile, logo, and portfolio.</p>
            </div>
            <ArrowUpRight size={16} className="text-ink-3 group-hover:text-ink transition-colors shrink-0" />
          </Link>
        )}

        {/* Profile */}
        <section id="profile" className="mb-12 scroll-mt-24">
          <p className="text-[11px] font-semibold tracking-[0.18em] text-blue uppercase mb-2">Profile</p>
          <h2 className="text-[22px] font-bold tracking-tight text-ink mb-5">Personal information</h2>

          <AccountForm
            initialName={user.name ?? null}
            initialEmail={user.email ?? null}
            initialPhone={user.phone}
            initialImage={user.image ?? null}
            initialBio={user.bio}
          />
        </section>

        {/* Payments */}
        <section id="payments" className="mb-12 scroll-mt-24">
          <p className="text-[11px] font-semibold tracking-[0.18em] text-blue uppercase mb-2">Payments</p>
          <h2 className="text-[22px] font-bold tracking-tight text-ink mb-5">Methods &amp; payouts</h2>

          <div className="rounded-2xl border border-line bg-paper p-6">
            <p className="text-sm font-semibold text-ink mb-1">No payment methods yet</p>
            <p className="text-[13px] text-ink-2 mb-5">Add EcoCash or a card to skip checkout next time.</p>
            <button className="rounded-xl bg-brand-600 text-white text-sm font-semibold px-4 py-2.5 hover:bg-brand-700 transition-colors">
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
                  <p className="text-[13px] text-ink-2 mt-0.5">{p.body}</p>
                </div>
                <input type="checkbox" defaultChecked={i < 2} className="mt-1.5 w-4 h-4 accent-navy" />
              </label>
            ))}
          </div>

          <div className="mt-4 rounded-2xl border border-line bg-paper p-5 flex items-center gap-3">
            <Globe size={16} className="text-ink-3" />
            <span className="text-[14px] font-medium text-ink flex-1">Language &amp; region</span>
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
              <ShieldCheck size={16} className="text-brand-600 mt-0.5" />
              <div className="flex-1">
                <p className="text-[14px] font-semibold tracking-tight text-ink">Two-factor authentication</p>
                <p className="text-[13px] text-ink-2 mt-0.5">Extra layer of security on sign-in.</p>
              </div>
              <button className="text-[13px] font-semibold text-navy hover:underline">Set up</button>
            </div>
            <div className="flex items-start gap-4 p-5">
              <Lock size={16} className="text-ink-3 mt-0.5" />
              <div className="flex-1">
                <p className="text-[14px] font-semibold tracking-tight text-ink">Active sessions</p>
                <p className="text-[13px] text-ink-2 mt-0.5">1 device, this browser. Sign out everywhere if you suspect access.</p>
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
                <p className="text-[13px] text-ink-2 mt-0.5">End your current session, your tickets stay in your account.</p>
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
            <button className="text-[13px] font-semibold text-rose-700 hover:underline shrink-0">Delete</button>
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
