export const ACCESS_COOKIE = "tp_access"
export const ACCESS_COOKIE_VALUE = "ok"

export const LAUNCH_DATE_ISO =
  process.env.NEXT_PUBLIC_LAUNCH_DATE ?? "2026-05-21T18:00:00+02:00"

export function isLaunchGateEnabled(): boolean {
  return process.env.LAUNCH_GATE_ENABLED === "true"
}

export function verifyAccessPassword(input: string): boolean {
  const expected = process.env.LAUNCH_PASSWORD
  if (!expected) return false
  if (input.length !== expected.length) return false
  let mismatch = 0
  for (let i = 0; i < expected.length; i++) {
    mismatch |= expected.charCodeAt(i) ^ input.charCodeAt(i)
  }
  return mismatch === 0
}
