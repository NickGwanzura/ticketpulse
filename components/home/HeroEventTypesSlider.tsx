"use client"

import { useEffect, useState } from "react"

const EVENT_TYPES = ["Concerts", "Dinners", "Conferences", "Marathons", "More"]

export default function HeroEventTypesSlider() {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % EVENT_TYPES.length)
    }, 2400)

    return () => window.clearInterval(timer)
  }, [])

  return (
    <p className="tp-fade-up-5 mt-10 text-[12px] font-semibold tracking-[0.08em] text-white/65" aria-live="polite">
      <span className="sr-only">Event types: </span>
      <span key={EVENT_TYPES[index]} className="inline-block animate-[tp-hero-type-in_420ms_ease-out]">
        {EVENT_TYPES[index]}
      </span>
      <span aria-hidden> · Zimbabwe events on TicketPulse</span>
    </p>
  )
}
