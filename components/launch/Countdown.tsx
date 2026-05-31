"use client"
import { useEffect, useState } from "react"

interface Parts {
  days: number
  hours: number
  minutes: number
  seconds: number
  done: boolean
}

function compute(targetMs: number): Parts {
  const diff = Math.max(0, targetMs - Date.now())
  const sec = Math.floor(diff / 1000)
  return {
    days:    Math.floor(sec / 86400),
    hours:   Math.floor((sec % 86400) / 3600),
    minutes: Math.floor((sec % 3600) / 60),
    seconds: sec % 60,
    done: diff === 0,
  }
}

export default function Countdown({ targetIso }: { targetIso: string }) {
  const targetMs = new Date(targetIso).getTime()
  const [parts, setParts] = useState<Parts | null>(null)

  useEffect(() => {
    queueMicrotask(() => setParts(compute(targetMs)))
    const id = setInterval(() => setParts(compute(targetMs)), 1000)
    return () => clearInterval(id)
  }, [targetMs])

  const cells: { label: string; value: number | null }[] = [
    { label: "Days",    value: parts?.days    ?? null },
    { label: "Hours",   value: parts?.hours   ?? null },
    { label: "Minutes", value: parts?.minutes ?? null },
    { label: "Seconds", value: parts?.seconds ?? null },
  ]

  return (
    <div className="grid grid-cols-4 gap-2 sm:gap-3">
      {cells.map(({ label, value }) => (
        <div
          key={label}
          className="rounded-2xl border border-line bg-paper px-3 py-4 sm:px-4 sm:py-5 text-center shadow-sm shadow-ink/[0.04]"
        >
          <div
            suppressHydrationWarning
            className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-ink tabular-nums"
          >
            {value === null ? "00" : value.toString().padStart(2, "0")}
          </div>
          <div className="mt-1.5 text-[11px] sm:text-[11px] font-semibold tracking-[0.18em] uppercase text-ink-3">
            {label}
          </div>
        </div>
      ))}
    </div>
  )
}
