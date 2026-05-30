"use client"

import { useEffect } from "react"
import Button from "@/components/ui/Button"
import { AlertTriangle } from "lucide-react"

export default function AdminSettingsError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("[admin/settings] error", error)
  }, [error])

  return (
    <div className="tp-fade-up">
      <div className="px-5 md:px-8 py-8 md:py-10">
        <div className="rounded-2xl border border-rose-200/60 bg-rose-50/40 p-6 max-w-2xl">
          <div className="flex items-start gap-3">
            <AlertTriangle size={18} className="text-rose-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-[15px] font-semibold text-rose-800 mb-1">Failed to load settings</p>
              <p className="text-[13px] text-rose-600 mb-4">
                Platform settings could not be loaded. This may be a temporary database issue.
              </p>
              {process.env.NODE_ENV === "development" && (
                <pre className="mb-4 text-[12px] bg-rose-100 rounded-xl px-4 py-3 overflow-auto text-rose-700 whitespace-pre-wrap break-words">
                  {error.message}
                </pre>
              )}
              <div className="flex items-center gap-3">
                <Button variant="secondary" onClick={reset}>
                  Try again
                </Button>
                <Button href="/admin">Back to admin</Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
