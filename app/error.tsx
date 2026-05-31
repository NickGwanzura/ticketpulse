"use client"

import { useEffect } from "react"
import Button from "@/components/ui/Button"

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("[app] unhandled error", error)
  }, [error])

  return (
    <div className="min-h-screen flex items-center justify-center px-5">
      <div className="max-w-md w-full text-center">
        <p className="text-[11px] font-semibold tracking-[0.18em] text-blue uppercase mb-3">Error</p>
        <h1 className="text-[28px] md:text-[36px] font-bold tracking-[-0.02em] text-ink mb-3">
          Something went wrong.
        </h1>
        <p className="text-[15px] text-ink-2 leading-relaxed mb-8">
          An unexpected error occurred. You can try again or return to the home page.
        </p>

        {process.env.NODE_ENV === "development" && (
          <pre className="mb-8 text-left text-[12px] bg-paper-2 border border-line rounded-xl px-4 py-3 overflow-auto text-ink-2 whitespace-pre-wrap break-words">
            {error.message}
          </pre>
        )}

        <div className="flex items-center justify-center gap-3">
          <Button variant="secondary" onClick={reset}>
            Try again
          </Button>
          <Button href="/">Back to home</Button>
        </div>
      </div>
    </div>
  )
}
