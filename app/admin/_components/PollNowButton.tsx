"use client"

import { useState, useCallback } from "react"
import { RefreshCw, CheckCircle, XCircle, AlertTriangle } from "lucide-react"
import { pollAllVelocityOrdersAction } from "@/app/admin/actions"
import { cn } from "@/lib/utils"

type PollResult = {
  checked: number
  fixed: number
  errors: number
  results: Array<{ orderId: string; action: string; message: string }>
}

export default function PollNowButton() {
  const [state, setState] = useState<{
    status: "idle" | "polling" | "done"
    result?: PollResult
  }>({ status: "idle" })

  const handlePoll = useCallback(async () => {
    setState({ status: "polling" })
    try {
      const result = await pollAllVelocityOrdersAction()
      setState({ status: "done", result })
    } catch (e) {
      setState({
        status: "done",
        result: {
          checked: 0,
          fixed: 0,
          errors: 1,
          results: [
            {
              orderId: "",
              action: "error",
              message: e instanceof Error ? e.message : "Failed to poll",
            },
          ],
        },
      })
    }

    // Auto-dismiss after 8 seconds
    setTimeout(() => {
      setState((prev) => (prev.status === "done" ? { status: "idle" } : prev))
    }, 8000)
  }, [])

  const hasResults = state.status === "done" && state.result
  const fixed = state.result?.fixed ?? 0
  const totalChecked = state.result?.checked ?? 0
  const errors = state.result?.errors ?? 0
  const anyFixed = fixed > 0
  const anyErrors = errors > 0

  return (
    <div className="relative inline-flex items-center">
      <button
        type="button"
        onClick={handlePoll}
        disabled={state.status === "polling"}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition-colors",
          "border border-indigo-200 text-indigo-700 hover:bg-indigo-50",
          "disabled:opacity-50 disabled:cursor-not-allowed",
        )}
        title="Poll all pending Velocity orders"
      >
        <RefreshCw
          size={11}
          className={state.status === "polling" ? "animate-spin" : ""}
        />
        {state.status === "polling"
          ? `Polling ${totalChecked}…`
          : "Poll now"}
      </button>

      {hasResults && (
        <div
          className={cn(
            "absolute left-1/2 -translate-x-1/2 top-full mt-1.5 z-20",
            "rounded-lg px-2.5 py-1.5 text-[11px] font-medium shadow-lg whitespace-nowrap",
            "flex items-center gap-1.5 pointer-events-none",
            anyFixed
              ? "bg-green-50 text-green-700 ring-1 ring-green-200"
              : anyErrors
                ? "bg-rose-50 text-rose-700 ring-1 ring-rose-200"
                : "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
          )}
        >
          {anyFixed ? (
            <CheckCircle size={11} className="shrink-0" />
          ) : anyErrors ? (
            <XCircle size={11} className="shrink-0" />
          ) : (
            <AlertTriangle size={11} className="shrink-0" />
          )}
          {totalChecked > 0
            ? `${fixed} fixed, ${totalChecked - fixed - errors} pending`
            : "No pending orders"}
        </div>
      )}
    </div>
  )
}
