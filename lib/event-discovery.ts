export function parseDiscoveryDate(value: string | undefined): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const parsed = new Date(`${value}T00:00:00Z`)
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) return null
  return new Date(`${value}T00:00:00+02:00`)
}

export function nextHarareDate(value: Date): Date {
  return new Date(value.getTime() + 24 * 60 * 60 * 1000)
}

export function parseDiscoveryPrice(value: string | undefined): number | null {
  if (!value?.trim()) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 1_000_000 ? parsed : null
}

export function safeEventReturnTo(value: string | string[] | undefined): string {
  if (typeof value !== "string") return "/events"
  if (value === "/events" || value.startsWith("/events?")) return value
  return "/events"
}
