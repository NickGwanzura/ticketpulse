"use client"

import { useEffect } from "react"
import Button from "@/components/ui/Button"
import { AlertTriangle } from "lucide-react"

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("[admin] unhandled error", error)
  }, [error])

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-8">
      <div className="max-w-md w-full text-center">
        <span className="inline-flex w-12 h-12 items-center justify-center rounded-2xl bg-rose-50 ring-1 ring-rose-200 mb-4">
          <AlertTriangle size={20} className="text-rose-600" />
        </span>
        <p className="text-[11px] font-semibold tracking-[0.18em] text-blue uppercase mb-2">Admin area</p>
        <h1 className="text-[22px] font-bold tracking-tight text-ink mb-2">Something went wrong</h1>
        <p className="text-[14px] text-ink-2 mb-6">
          The admin panel encountered an error. You can try again or return to the dashboard.
        </p>

        {process.env.NODE_ENV === "development" && (
          <pre className="mb-6 text-left text-[12px] bg-paper-2 border border-line rounded-xl px-4 py-3 overflow-auto text-ink-2 whitespace-pre-wrap break-words">
            {error.message}
          </pre>
        )}

        <div className="flex items-center justify-center gap-3">
          <Button variant="secondary" onClick={reset}>
            Try again
          </Button>
          <Button href="/admin">Back to admin</Button>
        </div>
      </div>
    </div>
  )
}
