import { auth, signOut } from "@/auth"
import Link from "next/link"
import { redirect } from "next/navigation"
import { ArrowLeft, LogOut, ShieldCheck } from "lucide-react"

export default async function LogoutPage() {
  const session = await auth()
  if (!session) redirect("/")

  const initials = (session.user.name?.[0] ?? session.user.email?.[0] ?? "U").toUpperCase()

  return (
    <div
      className="relative min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-12"
      style={{
        background:
          "radial-gradient(800px 400px at 80% -10%, #DBE8FB 0%, transparent 55%), radial-gradient(600px 300px at 0% 100%, rgba(254,235,200,0.4) 0%, transparent 55%), linear-gradient(180deg, #F6F9FC 0%, #FFFFFF 100%)",
      }}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-7">
          <Link href="/" className="inline-flex items-center gap-2 font-bold text-xl tracking-tight text-ink">
            <span className="relative inline-flex w-6 h-6 items-center justify-center rounded-md bg-navy">
              <span className="block w-1.5 h-1.5 rounded-full bg-white" />
            </span>
            TicketPulse
          </Link>
        </div>

        <div className="rounded-2xl border border-line bg-paper p-6 md:p-7 shadow-sm shadow-ink/[0.04] text-center">
          <div className="inline-flex w-14 h-14 items-center justify-center rounded-2xl bg-paper-2 ring-1 ring-line mb-5">
            <LogOut size={22} className="text-ink-2" />
          </div>

          <h1 className="text-[22px] font-bold tracking-tight text-ink">Sign out of TicketPulse?</h1>
          <p className="mt-2 text-[13.5px] text-ink-2 leading-relaxed">
            You&apos;ll need to sign in again to access tickets, orders, and your dashboard.
          </p>

          <div className="my-6 flex items-center gap-3 rounded-xl border border-line bg-paper-2 px-4 py-3 text-left">
            <span className="inline-flex w-9 h-9 items-center justify-center rounded-full bg-navy text-white text-[12px] font-semibold shrink-0">
              {initials}
            </span>
            <div className="min-w-0">
              <p className="text-[13px] font-semibold tracking-tight text-ink truncate">{session.user.name ?? "Account"}</p>
              <p className="text-[11.5px] text-ink-3 truncate">{session.user.email}</p>
            </div>
          </div>

          <form
            action={async () => {
              "use server"
              await signOut({ redirectTo: "/?signedOut=1" })
            }}
            className="space-y-2"
          >
            <button
              type="submit"
              className="w-full inline-flex items-center justify-center gap-2 bg-brand-600 text-white font-semibold text-sm py-3 rounded-xl hover:bg-brand-700 active:scale-[0.99] transition shadow-sm shadow-brand-600/20"
            >
              <LogOut size={14} /> Sign out
            </button>
            <Link
              href="/dashboard"
              className="w-full inline-flex items-center justify-center gap-1.5 border border-line bg-paper text-ink font-medium text-sm py-3 rounded-xl hover:border-line-2 transition-colors"
            >
              <ArrowLeft size={13} /> Stay signed in
            </Link>
          </form>
        </div>

        <p className="mt-5 text-center text-[12px] text-ink-3 inline-flex items-center justify-center gap-1.5 w-full">
          <ShieldCheck size={12} className="text-brand-600" />
          Your tickets stay safe, re-sign in with the same email.
        </p>
      </div>
    </div>
  )
}
