// Decorative floating-tickets illustration for empty states.
export default function EmptyTickets({ className }: { className?: string }) {
  return (
    <div className={`relative h-44 w-full max-w-md mx-auto ${className ?? ""}`} aria-hidden>
      {/* Background glow */}
      <div
        className="absolute inset-0 -z-10 [background:radial-gradient(280px_circle_at_50%_55%,rgba(5,112,222,0.08),transparent_60%)]"
      />

      {/* Ticket 3 (back, rotated left) */}
      <div className="absolute left-1/2 top-6 -translate-x-1/2 -rotate-[10deg] w-44 h-24 rounded-xl border border-line bg-paper shadow-sm shadow-ink/[0.05] overflow-hidden">
        <div className="h-2 bg-gradient-to-r from-violet-200 via-fuchsia-100 to-pink-100" />
        <div className="p-3">
          <div className="h-2 w-16 bg-paper-2 rounded mb-1.5" />
          <div className="h-1.5 w-24 bg-paper-2 rounded" />
        </div>
      </div>

      {/* Ticket 2 (middle, rotated right) */}
      <div className="absolute left-1/2 top-10 -translate-x-1/2 rotate-[8deg] w-48 h-26 rounded-xl border border-line bg-paper shadow-md shadow-ink/[0.07] overflow-hidden">
        <div className="h-2 bg-gradient-to-r from-sky-200 via-blue-100 to-cyan-100" />
        <div className="p-3">
          <div className="h-2 w-20 bg-paper-2 rounded mb-1.5" />
          <div className="h-1.5 w-28 bg-paper-2 rounded" />
        </div>
      </div>

      {/* Ticket 1 (front, slight rotate) */}
      <div className="absolute left-1/2 top-14 -translate-x-1/2 -rotate-[3deg] w-52 rounded-xl border border-line bg-paper shadow-lg shadow-ink/[0.08] overflow-hidden">
        <div className="relative h-3 bg-gradient-to-r from-amber-200 via-orange-100 to-rose-100">
          <span className="absolute -bottom-1 -left-1 w-2 h-2 rounded-full bg-paper-2 ring-1 ring-line" />
          <span className="absolute -bottom-1 -right-1 w-2 h-2 rounded-full bg-paper-2 ring-1 ring-line" />
        </div>
        <div className="p-3.5 flex items-center gap-3">
          <div className="text-2xl">🎟️</div>
          <div className="flex-1">
            <div className="h-2.5 w-3/4 bg-paper-2 rounded mb-1.5" />
            <div className="h-1.5 w-1/2 bg-paper-2 rounded" />
          </div>
          <div className="h-7 w-7 rounded-md bg-navy" />
        </div>
      </div>

      {/* Sparkles */}
      <span className="absolute top-2 left-[18%] w-1.5 h-1.5 rounded-full bg-blue/70 animate-pulse" />
      <span className="absolute top-3 right-[14%] w-1 h-1 rounded-full bg-amber-400/80 animate-pulse [animation-delay:0.6s]" />
      <span className="absolute bottom-6 left-[28%] w-1 h-1 rounded-full bg-emerald-500/70 animate-pulse [animation-delay:1.2s]" />
    </div>
  )
}
