import Link from "next/link"

export const metadata = {
  title: "404: Not Found | TicketPulse",
}

export default function NotFound() {
  return (
    <main className="tp-fade-up flex min-h-[calc(100vh-4rem)] items-center justify-center px-5 py-20">
      <div className="w-full max-w-md rounded-2xl border border-line bg-paper shadow-sm ring-1 ring-blue/10 px-8 py-12 text-center">
        <p className="text-[11px] font-semibold tracking-[0.18em] text-blue uppercase mb-4">
          404 Not found
        </p>
        <h1 className="text-[28px] md:text-[34px] font-bold tracking-tight leading-[1.1] text-ink mb-3">
          This page slipped past us.
        </h1>
        <p className="text-[14.5px] text-ink-2 mb-8">
          The link may have moved, been removed, or never existed.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-lg bg-navy px-5 py-2.5 text-[13.5px] font-semibold text-white hover:bg-navy-700 transition-colors"
          >
            Back to home
          </Link>
          <Link
            href="/events"
            className="inline-flex items-center justify-center rounded-lg border border-line bg-paper-2 px-5 py-2.5 text-[13.5px] font-semibold text-ink-2 hover:bg-paper-3 transition-colors"
          >
            Browse events
          </Link>
        </div>
      </div>
    </main>
  )
}
