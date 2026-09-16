import { AlertTriangle, MessageCircle } from "lucide-react"

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
        <p className="font-semibold">EcoCash payment notice</p>
        <p>
          Confirmations may be delayed. Approve the USSD prompt and wait for
          confirmation. Please don&apos;t pay again if your wallet was debited.
          For help, WhatsApp{" "}
          <a
            href="https://wa.me/263788689923"
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-8 items-center gap-1 font-bold underline decoration-amber-400 underline-offset-2 transition-colors hover:text-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 focus:ring-offset-amber-50"
          >
            <MessageCircle size={13} aria-hidden="true" />
            +263 78 868 9923
          </a>
          . Please don&apos;t pay twice.
        </p>
      </div>
    </div>
  )
}
