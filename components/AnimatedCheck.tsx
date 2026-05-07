interface AnimatedCheckProps {
  size?: number
  className?: string
}

export default function AnimatedCheck({ size = 56, className }: AnimatedCheckProps) {
  return (
    <span
      className={`relative inline-flex items-center justify-center rounded-2xl bg-emerald-50 ring-1 ring-emerald-200/60 ${className ?? ""}`}
      style={{ width: size, height: size }}
    >
      <span className="absolute inset-0 rounded-2xl bg-emerald-500/15 blur-xl -z-10" />
      <svg width={size * 0.5} height={size * 0.5} viewBox="0 0 24 24" fill="none" aria-hidden>
        <circle
          cx="12" cy="12" r="11"
          stroke="#10b981" strokeWidth="2" strokeLinecap="round"
          pathLength="100"
          style={{
            strokeDasharray: 100,
            strokeDashoffset: 100,
            animation: "tp-check-circle 0.5s 0.05s cubic-bezier(0.4, 0, 0.2, 1) forwards",
          }}
        />
        <path
          d="M7 12.5 L 10.5 16 L 17 9"
          stroke="#10b981" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" fill="none"
          pathLength="100"
          style={{
            strokeDasharray: 100,
            strokeDashoffset: 100,
            animation: "tp-check-mark 0.4s 0.5s cubic-bezier(0.4, 0, 0.2, 1) forwards",
          }}
        />
      </svg>
      <style>{`
        @keyframes tp-check-circle { to { stroke-dashoffset: 0; } }
        @keyframes tp-check-mark   { to { stroke-dashoffset: 0; } }
      `}</style>
    </span>
  )
}
