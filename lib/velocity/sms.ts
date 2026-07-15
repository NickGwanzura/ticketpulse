import "server-only"
import { randomUUID } from "crypto"

import type {
  VelocitySmsRequest,
  SmsSendResult,
  SmsBatchResult,
} from "./types"
import type { SmsTemplateName } from "./templates"
import { SmsError } from "./types"
import { getSmsBaseUrl, getSmsTimeout, getSmsHeaders } from "./env"
import { resolveTemplateBody } from "./templates"
import { normaliseMsisdn } from "./validation"
import { log } from "@/lib/logger"

// ─── Configuration ───────────────────────────────────────────────────────

const MAX_RETRIES = 3
const BASE_DELAY_MS = 1_000

// ─── Helpers ─────────────────────────────────────────────────────────────

function classifyStatus(status: number): "RETRYABLE" | "FATAL" | "SUCCESS" {
  if (status >= 200 && status < 300) return "SUCCESS"
  if (status === 429) return "RETRYABLE"
  if (status >= 500) return "RETRYABLE"
  if (status === 401 || status === 403) return "FATAL"
  return "FATAL"
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function parseBody(text: string, statusCode: number) {
  try {
    const json = JSON.parse(text)
    return {
      status: json.status ?? statusCode,
      result: json.result ?? json.message ?? text.slice(0, 500),
    }
  } catch {
    return { status: statusCode, result: text.slice(0, 500) }
  }
}

// ─── Core send (single recipient) ────────────────────────────────────────

async function sendSingle(msisdn: string, message: string): Promise<SmsSendResult> {
  const messageReference = randomUUID()
  const timeoutMs = getSmsTimeout()
  const url = `${getSmsBaseUrl()}/customers/send-sms`
  const headers = getSmsHeaders()

  const start = Date.now()

  const body: VelocitySmsRequest = {
    recipient: msisdn,
    message,
  }

  let lastError: Error | null = null

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)

    try {
      const res = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      })

      clearTimeout(timer)
      const text = await res.text()
      const parsed = parseBody(text, res.status)
      const durationMs = Date.now() - start

      log.info("velocity/sms — provider response", {
        messageReference,
        msisdn,
        attempt,
        statusCode: res.status,
        providerStatus: parsed.status,
        durationMs,
      })

      const category = classifyStatus(res.status)
      if (category === "SUCCESS") {
        return {
          ok: true,
          messageReference,
          recipient: msisdn,
          providerStatus: parsed.status,
          providerResult: parsed.result,
          durationMs,
        }
      }

      if (category === "FATAL") {
        throw new SmsError(
          `VelocityAfrica returned ${res.status}: ${parsed.result}`,
          res.status === 401 || res.status === 403 ? "AUTH" : "PROVIDER",
          res.status,
          false,
        )
      }

      lastError = new SmsError(
        `VelocityAfrica returned ${res.status}: ${parsed.result}`,
        "PROVIDER",
        res.status,
        true,
      )
    } catch (err) {
      clearTimeout(timer)

      if (err instanceof SmsError) throw err

      const isTimeout = err instanceof DOMException && err.name === "AbortError"
      if (isTimeout) {
        lastError = new SmsError(`Timeout after ${timeoutMs}ms`, "TIMEOUT", undefined, true)
      } else if (err instanceof TypeError) {
        lastError = new SmsError(`Network error: ${(err as Error).message}`, "NETWORK", undefined, true)
      } else {
        lastError = err instanceof Error ? err : new SmsError(String(err), "UNKNOWN", undefined, true)
      }

      log.warn("velocity/sms — attempt failed", {
        messageReference,
        msisdn,
        attempt,
        error: lastError.message,
      })
    }

    if (attempt < MAX_RETRIES) {
      const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1) + Math.random() * 500
      await sleep(delay)
    }
  }

  const durationMs = Date.now() - start
  log.error("velocity/sms — all retries exhausted", {
    messageReference,
    msisdn,
    maxRetries: MAX_RETRIES,
    durationMs,
    error: lastError?.message,
  })

  throw lastError ?? new SmsError("SMS send failed after all retries", "UNKNOWN", undefined, true)
}

// ─── Public API ──────────────────────────────────────────────────────────

/**
 * Send an SMS using a named template from the registry.
 *
 * @param template - Template name (e.g. "TICKET_CONFIRMATION")
 * @param recipient - Phone number (077..., +263..., 263...)
 * @param variables - Optional {{placeholder}} values for the template body
 *
 * Returns a structured batch result.
 */
export async function sendSms(
  template: SmsTemplateName,
  recipient: string,
  variables: Record<string, string> = {},
): Promise<SmsBatchResult> {
  const msisdn = normaliseMsisdn(recipient)
  const message = resolveTemplateBody(template, variables)

  const result = await sendSingle(msisdn, message)

  log.info("velocity/sms — sent", {
    template,
    messageReference: result.messageReference,
    msisdn,
    ok: result.ok,
    durationMs: result.durationMs,
  })

  return {
    success: result.ok,
    template,
    messageReference: result.messageReference,
    providerResponse: {
      status: result.providerStatus,
      result: result.providerResult,
    },
    results: [result],
  }
}
