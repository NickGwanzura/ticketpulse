import { auth } from "@/auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Banknote } from "lucide-react"
import { getOrganizerBalance } from "../actions"
import PayoutForm from "./PayoutForm"

export default async function RequestPayoutPage() {
  const session = await auth()
  if (!session?.user) {
    redirect("/auth/signin?callbackUrl=/payouts/request")
  }

  const balance = await getOrganizerBalance(session.user.id)

  if (balance.availableBalance <= 0) {
    return (
      <div className="max-w-lg mx-auto px-5 md:px-0 pt-8 pb-16 text-center">
        <div className="rounded-2xl border border-line bg-paper p-10">
          <div className="inline-flex w-12 h-12 items-center justify-center rounded-xl bg-amber-50 mb-4">
            <Banknote size={22} className="text-amber-600" />
          </div>
          <h1 className="text-[20px] font-bold tracking-tight text-ink">No funds available</h1>
          <p className="text-[14px] text-ink-2 mt-2 max-w-xs mx-auto">
            Your available balance is zero. Revenue from paid ticket sales will appear here after TicketPulse deducts the platform fee.
          </p>
          <Link
            href="/payouts"
            className="mt-6 inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-5 py-2.5 text-[13px] font-semibold text-white hover:bg-brand-700 transition-colors"
          >
            <ArrowLeft size={14} /> Back to payouts
          </Link>
        </div>
      </div>
    )
  }

  return <PayoutForm balance={balance} />
}
