import { AlertTriangle, MessageCircle } from "lucide-react"

const WHATSAPP_MESSAGE = [
  "Hi, EcoCash deducted my money but I got no tickets. Proof attached.",
  "Name: ",
  "EcoCash no: ",
  "Event: ",
].join("\n")

export const ECOCASH_HELP_URL = `https://wa.me/263788689923?text=${encodeURIComponent(WHATSAPP_MESSAGE)}`

export default function CheckoutPaymentNotice() {
  return (
    <div
      role="status"
      aria-label="EcoCash service notice"
      className="mb-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-amber-900"
    >
      <AlertTriangle
        size={17}
        className="mt-0.5 shrink-0 text-amber-600"
        aria-hidden="true"
      />
      <div className="min-w-0 text-[12px] leading-5 md:text-[13px]">
        <p className="font-semibold">EcoCash is not working at 100% right now</p>
        <p>
          If money was deducted from your wallet but you did not receive your
          tickets, send your proof of payment (EcoCash confirmation message or
          screenshot) on WhatsApp. We will release your tickets within 3
          minutes. Please don&apos;t pay twice.
        </p>
        <a
          href={ECOCASH_HELP_URL}
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-[#25D366] px-3 py-1.5 font-bold text-white transition-colors hover:bg-[#1fb857] focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 focus:ring-offset-amber-50"
        >
          <MessageCircle size={14} aria-hidden="true" />
          Send proof on WhatsApp
        </a>
      </div>
    </div>
  )
}
