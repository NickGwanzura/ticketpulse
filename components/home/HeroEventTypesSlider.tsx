"use client"

import { useEffect, useState } from "react"

const EVENT_TYPES = ["Concerts", "Dinners", "Conferences", "Marathons", "More"]

export default function HeroEventTypesSlider() {
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    if (paused) return
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % EVENT_TYPES.length)
    }, 6000)

    return () => window.clearInterval(timer)
  }, [paused])

  return (
    <div
      className="tp-fade-up-5 mx-auto mt-10 w-fit text-[11px] font-bold uppercase tracking-[0.2em] text-[#fbf2e4]/65"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <p aria-live="polite">
      <span className="sr-only">Event types: </span>
      <span key={EVENT_TYPES[index]} className="inline-block animate-[tp-hero-type-in_420ms_ease-out] text-[#f6c995]">
        {EVENT_TYPES[index]}
      </span>
      <span aria-hidden> · ticketpulse events</span>
      </p>
      <div className="mt-3 flex justify-center gap-1.5" aria-hidden="true">
        {EVENT_TYPES.map((type, dotIndex) => (
          <span
            key={type}
            className={`h-1 rounded-full transition-all duration-500 ${dotIndex === index ? "w-7 bg-[#f6c995]" : "w-1 bg-[#fbf2e4]/35"}`}
          />
        ))}
      </div>
    </div>
  )
}
