"use client"
import { useEffect, useState } from "react"

interface Piece {
  id: number
  left: number
  delay: number
  duration: number
  rotate: number
  size: number
  color: string
  shape: "rect" | "circle"
}

const COLORS = ["#0570DE", "#0a2540", "#10b981", "#f59e0b", "#ef4444", "#a78bfa", "#06b6d4"]

function makePieces(count: number): Piece[] {
  return Array.from({ length: count }).map((_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 0.6,
    duration: 1.6 + Math.random() * 1.6,
    rotate: Math.random() * 360,
    size: 6 + Math.random() * 8,
    color: COLORS[i % COLORS.length],
    shape: Math.random() > 0.5 ? "rect" : "circle",
  }))
}

export default function Confetti({ count = 60 }: { count?: number }) {
  const [pieces, setPieces] = useState<Piece[]>([])

  useEffect(() => {
    queueMicrotask(() => { setPieces(makePieces(count)) })
  }, [count])

  if (!pieces.length) return null

  return (
    <div className="pointer-events-none fixed inset-0 -z-0 overflow-hidden" aria-hidden>
      {pieces.map((p) => (
        <span
          key={p.id}
          className="absolute -top-6"
          style={{
            left: `${p.left}%`,
            width: `${p.size}px`,
            height: `${p.size * 1.4}px`,
            background: p.color,
            borderRadius: p.shape === "circle" ? "50%" : "2px",
            transform: `rotate(${p.rotate}deg)`,
            animation: `tp-confetti-fall ${p.duration}s ${p.delay}s cubic-bezier(0.2, 0.65, 0.5, 1) forwards`,
            opacity: 0,
          }}
        />
      ))}
      <style>{`
        @keyframes tp-confetti-fall {
          0%   { opacity: 0; transform: translateY(-30vh) rotate(0deg); }
          15%  { opacity: 1; }
          100% { opacity: 0; transform: translateY(110vh) rotate(540deg); }
        }
      `}</style>
    </div>
  )
}
