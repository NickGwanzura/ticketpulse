"use client"

import { useEffect } from "react"
import Button from "@/components/ui/Button"

export default function OrganizerError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("[organizer] error", error)
  }, [error])

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-5">
      <div className="max-w-md w-full text-center">
        <p className="text-[11px] font-semibold tracking-[0.18em] text-blue uppercase mb-3">Error</p>
        <h1 className="text-[28px] font-bold tracking-[-0.02em] text-ink mb-3">
          Organizer dashboard error.
        </h1>
        <p className="text-[15px] text-ink-2 leading-relaxed mb-8">
          Something went wrong loading your organizer dashboard. Please try again.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Button variant="secondary" onClick={reset}>Try again</Button>
          <Button href="/">Back to home</Button>
        </div>
      </div>
    </div>
  )
}
