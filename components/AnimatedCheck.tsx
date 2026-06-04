interface AnimatedCheckProps {
  size?: number
  className?: string
}

export default function AnimatedCheck({ size = 56, className }: AnimatedCheckProps) {
  return (
    <span
      className={`relative inline-flex items-center justify-center rounded-2xl bg-green-50 ring-1 ring-green-200/60 ${className ?? ""}`}
      style={{ width: size, height: size }}
    >
      {/* Blur glow behind */}
      <span className="absolute inset-0 rounded-2xl bg-green-500/15 blur-xl -z-10" />

      {/* Ripple rings — appear after the check draws (0.9s delay) */}
      <span
        className="absolute inset-0 rounded-2xl ring-2 ring-green-400/40"
        style={{ animation: "tp-check-ripple 1.2s 0.9s cubic-bezier(0, 0, 0.2, 1) infinite" }}
      />
      <span
        className="absolute inset-0 rounded-2xl ring-2 ring-green-400/20"
        style={{ animation: "tp-check-ripple 1.2s 1.2s cubic-bezier(0, 0, 0.2, 1) infinite" }}
      />

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
        @keyframes tp-check-circle  { to { stroke-dashoffset: 0; } }
        @keyframes tp-check-mark    { to { stroke-dashoffset: 0; } }
        @keyframes tp-check-ripple  {
          0%   { transform: scale(1);    opacity: 1; }
          100% { transform: scale(1.55); opacity: 0; }
        }
      `}</style>
    </span>
  )
}
