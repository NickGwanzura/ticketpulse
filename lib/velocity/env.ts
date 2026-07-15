/**
 * Velocity Africa SMS — environment variable configuration.
 *
 * Hits POST {base}/customers/send-sms with { recipient, message }.
 *
 * Supports three auth modes:
 *   1. API key:    VELOCITY_SMS_API_KEY        (sent as X-API-Key)
 *   2. Basic auth: VELOCITY_SMS_USERNAME + VELOCITY_SMS_PASSWORD
 *   3. Bearer:     VELOCITY_AFRICA_SMS_TOKEN    (legacy fallback)
 */

export function getSmsBaseUrl(): string {
  return process.env.VELOCITY_SMS_BASE_URL ?? "https://sms.velocityafrica.net/api"
}

export function getSmsTimeout(): number {
  const t = process.env.VELOCITY_SMS_TIMEOUT
  return t ? Number(t) || 30000 : 30000
}

export function getSmsHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  }

  const user = process.env.VELOCITY_SMS_USERNAME
  const pass = process.env.VELOCITY_SMS_PASSWORD
  const apiKey = process.env.VELOCITY_SMS_API_KEY
  const bearer = process.env.VELOCITY_AFRICA_SMS_TOKEN

  if (apiKey) {
    headers["X-API-Key"] = apiKey
  } else if (user && pass) {
    headers["Authorization"] = `Basic ${Buffer.from(`${user}:${pass}`).toString("base64")}`
  } else if (bearer) {
    headers["Authorization"] = `Bearer ${bearer}`
  } else {
    throw new Error(
      "No SMS credentials configured. Set VELOCITY_SMS_USERNAME + VELOCITY_SMS_PASSWORD, VELOCITY_SMS_API_KEY, or VELOCITY_AFRICA_SMS_TOKEN.",
    )
  }

  return headers
}

export function isSmsConfigured(): boolean {
  return !!(
    process.env.VELOCITY_SMS_BASE_URL &&
    (process.env.VELOCITY_SMS_USERNAME ||
      process.env.VELOCITY_SMS_API_KEY ||
      process.env.VELOCITY_AFRICA_SMS_TOKEN)
  )
}
