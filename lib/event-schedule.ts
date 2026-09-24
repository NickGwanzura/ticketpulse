const CAT_OFFSET_MS = 2 * 60 * 60 * 1000

const pad = (value: number) => String(value).padStart(2, "0")

/** Parse a datetime-local value as Africa/Harare time (CAT, UTC+2). */
export function parseHarareDateTimeLocal(value: string): Date | null {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/)
  if (!match) return null

  const [, yearText, monthText, dayText, hourText, minuteText] = match
  const year = Number(yearText)
  const month = Number(monthText)
  const day = Number(dayText)
  const hour = Number(hourText)
  const minute = Number(minuteText)

  const utcMs = Date.UTC(year, month - 1, day, hour, minute) - CAT_OFFSET_MS
  const date = new Date(utcMs)
  if (Number.isNaN(date.getTime())) return null

  // Date.UTC normalizes impossible values such as 31 February. Convert back
  // to CAT and require an exact round trip so tampered form submissions fail.
  const harare = new Date(utcMs + CAT_OFFSET_MS)
  if (
    harare.getUTCFullYear() !== year ||
    harare.getUTCMonth() !== month - 1 ||
    harare.getUTCDate() !== day ||
    harare.getUTCHours() !== hour ||
    harare.getUTCMinutes() !== minute
  ) {
    return null
  }

  return date
}

/** Format an instant for a datetime-local input in Africa/Harare time (CAT). */
export function formatHarareDateTimeLocal(date: Date | null): string {
  if (!date || Number.isNaN(date.getTime())) return ""

  const harare = new Date(date.getTime() + CAT_OFFSET_MS)
  return `${harare.getUTCFullYear()}-${pad(harare.getUTCMonth() + 1)}-${pad(harare.getUTCDate())}T${pad(harare.getUTCHours())}:${pad(harare.getUTCMinutes())}`
}

/** Format a date using Zimbabwe's event timezone, regardless of device timezone. */
export function formatHarareDate(date: Date, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat("en-GB", { ...options, timeZone: "Africa/Harare" }).format(date)
}

export function isFutureEventStart(startsAt: Date, now = new Date()): boolean {
  return startsAt.getTime() > now.getTime()
}
