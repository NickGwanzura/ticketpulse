"use client"

import { createContext, useCallback, useContext, useState } from "react"
import { CheckCircle2, XCircle, Info, X } from "lucide-react"

type ToastVariant = "success" | "error" | "info"
type ToastItem = { id: string; title: string; description?: string; variant: ToastVariant }

type ToastContextValue = {
  toast: (opts: { title: string; description?: string; variant?: ToastVariant }) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const VARIANT_STYLE: Record<ToastVariant, { icon: typeof CheckCircle2; bg: string; iconColor: string }> = {
  success: { icon: CheckCircle2, bg: "border-emerald-200 bg-emerald-50", iconColor: "text-emerald-600" },
  error: { icon: XCircle, bg: "border-red-200 bg-red-50", iconColor: "text-red-600" },
  info: { icon: Info, bg: "border-sky-200 bg-sky-50", iconColor: "text-sky-600" },
}

/**
 * Every server action across the app returns `{ ok, message }` and, before
 * this, every caller rendered that result differently (inline paragraph,
 * banner, nothing at all). This is the one shared place a "Published",
 * "Payout sent", or "Could not save — try again" actually shows up.
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const toast = useCallback((opts: { title: string; description?: string; variant?: ToastVariant }) => {
    const id = crypto.randomUUID()
    setToasts((prev) => [...prev, { id, variant: "info", ...opts }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 5000)
  }, [])

  const dismiss = (id: string) => setToasts((prev) => prev.filter((t) => t.id !== id))

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 w-[calc(100vw-2rem)] max-w-sm" aria-live="polite">
        {toasts.map((t) => {
          const style = VARIANT_STYLE[t.variant]
          const Icon = style.icon
          return (
            <div
              key={t.id}
              role="status"
              className={`flex items-start gap-2.5 rounded-xl border ${style.bg} px-4 py-3 shadow-lg animate-in fade-in slide-in-from-bottom-2`}
            >
              <Icon size={16} className={`${style.iconColor} shrink-0 mt-0.5`} />
              <div className="min-w-0 flex-1">
                <p className="text-[13.5px] font-semibold text-ink">{t.title}</p>
                {t.description && <p className="text-[12.5px] text-ink-2 mt-0.5">{t.description}</p>}
              </div>
              <button type="button" onClick={() => dismiss(t.id)} aria-label="Dismiss" className="text-ink-3 hover:text-ink shrink-0">
                <X size={14} />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error("useToast must be used within a ToastProvider")
  return ctx
}
