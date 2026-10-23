import "server-only"

import { rateLimit } from "@/lib/rate-limit"

const minuteLimit = rateLimit({ windowMs: 60_000, max: 3 })
const hourlyIpLimit = rateLimit({ windowMs: 60 * 60_000, max: 30 })
const dailyIpEmailLimit = rateLimit({ windowMs: 24 * 60 * 60_000, max: 5 })

export async function allowSignupAttempt(ip: string, email: string): Promise<boolean> {
  const key = ip || "unknown"
  const requireShared = Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)
  const results = await Promise.all([
    minuteLimit.checkDistributed(`signup:minute:${key}`, { requireShared }),
    hourlyIpLimit.checkDistributed(`signup:hour:${key}`, { requireShared }),
    // Pair email with IP so an attacker cannot lock out someone else's address.
    dailyIpEmailLimit.checkDistributed(`signup:ip-email:${key}:${email}`, { requireShared }),
  ])
  return results.every((result) => result.allowed)
}

export async function verifySignupChallenge(token: string, ip: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY
  if (!secret) return false
  if (!token || token.length > 2048) return false

  try {
    const body = new URLSearchParams({ secret, response: token })
    if (ip && ip !== "unknown") body.set("remoteip", ip)
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    })
    if (!response.ok) return false
    const result = await response.json() as { success?: boolean; hostname?: string }
    const appHostname = new URL(process.env.NEXT_PUBLIC_APP_URL ?? "https://ticketpulse.tech").hostname
    return result.success === true &&
      (result.hostname === appHostname || result.hostname?.endsWith(`.${appHostname}`) === true)
  } catch {
    return false
  }
}
