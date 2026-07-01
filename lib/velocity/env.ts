/**
 * Velocity Africa SMS — environment variable configuration.
 *
 * Supports two auth modes:
 *   1. Basic auth: VELOCITY_SMS_USERNAME + VELOCITY_SMS_PASSWORD
 *   2. API key:    VELOCITY_SMS_API_KEY
 *   3. Bearer:     VELOCITY_AFRICA_SMS_TOKEN  (legacy fallback)
 */

const ENV_KEYS = [
  "VELOCITY_SMS_BASE_URL",
  "VELOCITY_SMS_USERNAME",
  "VELOCITY_SMS_PASSWORD",
  "VELOCITY_SMS_API_KEY",
  "VELOCITY_SMS_TIMEOUT",
] as const

export type SmsEnv = Record<(typeof ENV_KEYS)[number], string>

export function getSmsEnv(): SmsEnv {
  const missing: string[] = []

  const raw = {} as Record<string, string>
  for (const key of ENV_KEYS) {
    const val = process.env[key]
    if (!val) {
      if (key === "VELOCITY_SMS_TIMEOUT") {
        raw[key] = "30000"
        continue
      }
      // Username/password are optional if VELOCITY_AFRICA_SMS_TOKEN is set
      if ((key === "VELOCITY_SMS_USERNAME" || key === "VELOCITY_SMS_PASSWORD") && process.env.VELOCITY_AFRICA_SMS_TOKEN) {
        raw[key] = ""
        continue
      }
      missing.push(key)
    } else {
      raw[key] = val
    }
  }

  // Allow VELOCITY_AFRICA_SMS_TOKEN as a fallback auth mechanism
  if (!raw.VELOCITY_SMS_USERNAME && !raw.VELOCITY_SMS_PASSWORD && !raw.VELOCITY_SMS_API_KEY && !process.env.VELOCITY_AFRICA_SMS_TOKEN) {
    missing.push("VELOCITY_AFRICA_SMS_TOKEN")
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required SMS env vars: ${missing.join(", ")}`,
    )
  }

  return raw as unknown as SmsEnv
}

export { ENV_KEYS }
