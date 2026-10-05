"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"

export default function OrderEventFilter({
  events,
  value,
}: {
  events: { id: string; title: string }[]
  value: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function onChange(next: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (next) params.set("event", next)
    else params.delete("event")
    params.delete("page")
    const qs = params.toString()
    router.push(qs ? `${pathname}?${qs}` : pathname)
  }

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label="Filter by event"
      className="w-full md:w-56 rounded-xl border border-line bg-paper px-3 py-2.5 text-[13px] text-ink focus:outline-none focus:border-line-2 focus:ring-4 focus:ring-brand-500/10"
    >
      <option value="">All events</option>
      {events.map((e) => (
        <option key={e.id} value={e.id}>
          {e.title}
        </option>
      ))}
    </select>
  )
}
