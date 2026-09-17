"use client"

import { RefreshCw, Sparkles } from "lucide-react"

import { useAiGenerate } from "./use-ai-generate"

export default function AiReconciliationCard() {
  const { data, loading, error, generate } = useAiGenerate<{ summary: string }>()

  return (
    <div className="rounded-2xl border border-brand-200/70 bg-brand-50/40 p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sparkles size={15} className="text-brand-600" />
          <h2 className="text-[14px] font-semibold tracking-tight text-ink">AI reconciliation summary</h2>
        </div>
        <button
          type="button"
          onClick={() => generate("/api/ai/reconciliation", {})}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-lg border border-brand-200 bg-paper px-3 py-2 text-[12px] font-semibold text-brand-700 transition-colors hover:bg-brand-50 disabled:cursor-wait disabled:opacity-50"
        >
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
          {data ? "Refresh" : "Explain report"}
        </button>
      </div>
      {error && <p className="mt-3 text-[12px] text-rose-600">{error}</p>}
      {loading && <div className="mt-4 h-4 w-3/4 animate-pulse rounded bg-brand-200/50" />}
      {!data && !loading && !error && (
        <p className="mt-2 text-[13px] leading-relaxed text-ink-2">
          Generate a plain-language explanation of the reconciled receipts and any flagged exceptions.
        </p>
      )}
      {data && !loading && <p className="mt-3 text-[13px] leading-relaxed text-ink-2">{data.summary}</p>}
      <p className="mt-3 text-[11px] text-ink-3">AI explains the report; ledger totals remain authoritative.</p>
    </div>
  )
}
