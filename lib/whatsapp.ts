import "server-only"
import { log } from "@/lib/logger"

type OpenWAConfig = {
  baseUrl: string
  apiKey: string
  defaultSessionId: string
}

function config(): OpenWAConfig {
  const baseUrl = process.env.OPENWA_URL
  const apiKey = process.env.OPENWA_API_KEY
  const defaultSessionId = process.env.OPENWA_SESSION_ID

  if (!baseUrl || !apiKey || !defaultSessionId) {
    throw new Error(
      "Missing OpenWA configuration. Set OPENWA_URL, OPENWA_API_KEY, and OPENWA_SESSION_ID in .env.local",
    )
  }

  return { baseUrl, apiKey, defaultSessionId }
}

async function openwaFetch<T = unknown>(
  path: string,
  options: RequestInit & { sessionId?: string } = {},
): Promise<T> {
  const { baseUrl, apiKey } = config()
  const url = `${baseUrl.replace(/\/+$/, "")}/api${path}`

  const res = await fetch(url, {
    ...options,
    signal: options.signal ?? AbortSignal.timeout(20_000),
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": apiKey,
      ...options.headers,
    },
  })

  if (!res.ok) {
    const body = await res.text().catch(() => "Unknown error")
    throw new Error(`OpenWA API error (${res.status}): ${body}`)
  }

  return res.json() as Promise<T>
}

/**
 * Format a phone number into a WhatsApp chat ID.
 * Strips non-digits, removes leading 0 if present, and appends @c.us.
 *
 * @example formatChatId("+263 77 123 4567") // "263771234567@c.us"
 * @example formatChatId("0771234567")        // "771234567@c.us"
 */
export function formatChatId(phone: string): string {
  let digits = phone.replace(/\D/g, "")
  if (digits.startsWith("0")) {
    digits = `263${digits.slice(1)}`
  } else if (digits.length === 9 && digits.startsWith("7")) {
    digits = `263${digits}`
  }
  return `${digits}@c.us`
}

// ─── Session ────────────────────────────────────────────────────────────────

export type SessionStatus =
  | "created"
  | "initializing"
  | "qr_ready"
  | "authenticating"
  | "ready"
  | "disconnected"
  | "failed"

export type SessionInfo = {
  id: string
  name: string
  status: SessionStatus
  phone: string | null
  pushName: string | null
  connectedAt: string | null
  lastActive: string | null
}

/**
 * Get the current status and details of a WhatsApp session.
 */
export async function getSession(sessionId?: string): Promise<SessionInfo> {
  const sid = sessionId ?? config().defaultSessionId
  return openwaFetch(`/sessions/${sid}`)
}

// ─── Send Text ──────────────────────────────────────────────────────────────

export type SendTextResponse = {
  messageId: string
  timestamp: number
}

/**
 * Send a plain text WhatsApp message to a chat.
 *
 * @param chatId - The recipient's chat ID (e.g. "263771234567@c.us")
 * @param text   - The message body (max 4096 characters)
 */
export async function sendText(
  chatId: string,
  text: string,
  sessionId?: string,
): Promise<SendTextResponse> {
  const sid = sessionId ?? config().defaultSessionId
  return openwaFetch(`/sessions/${sid}/messages/send-text`, {
    method: "POST",
    body: JSON.stringify({ chatId, text }),
  })
}

// ─── Send Image ─────────────────────────────────────────────────────────────

export type SendMediaOptions = {
  chatId: string
  /** Public URL of the image */
  url?: string
  /** Base64-encoded image data (use when a public URL isn't available) */
  base64?: string
  /** MIME type (required when using base64) */
  mimetype?: string
  /** Optional caption */
  caption?: string
  /** Optional filename */
  filename?: string
}

/**
 * Send an image message via WhatsApp.
 * Provide either a public `url` or `base64` data (with `mimetype`).
 */
export async function sendImage(
  options: SendMediaOptions,
  sessionId?: string,
): Promise<SendTextResponse> {
  const sid = sessionId ?? config().defaultSessionId
  return openwaFetch(`/sessions/${sid}/messages/send-image`, {
    method: "POST",
    body: JSON.stringify(options),
  })
}

// ─── Send Document ──────────────────────────────────────────────────────────

/**
 * Send a document/file via WhatsApp.
 */
export async function sendDocument(
  options: SendMediaOptions,
  sessionId?: string,
): Promise<SendTextResponse> {
  const sid = sessionId ?? config().defaultSessionId
  return openwaFetch(`/sessions/${sid}/messages/send-document`, {
    method: "POST",
    body: JSON.stringify(options),
  })
}

// ─── Bulk Messaging ─────────────────────────────────────────────────────────

export type BulkMessageItem = {
  chatId: string
  type: "text" | "image" | "video" | "audio" | "document"
  content: {
    text?: string
    image?: { url?: string; base64?: string; mimetype?: string }
    video?: { url?: string; base64?: string; mimetype?: string }
    audio?: { url?: string; base64?: string; mimetype?: string }
    document?: { url?: string; base64?: string; mimetype?: string; filename?: string }
    caption?: string
  }
  variables?: Record<string, string>
}

export type BulkMessageOptions = {
  /** Delay between messages in ms (min: 1000, default: 3000) */
  delayBetweenMessages?: number
  /** Add random 0-2s to delay (default: true) */
  randomizeDelay?: boolean
  /** Stop batch on first error (default: false) */
  stopOnError?: boolean
}

export type BulkMessageResponse = {
  batchId: string
  status: string
  totalMessages: number
  estimatedCompletionTime?: string
  statusUrl: string
}

/**
 * Send messages to multiple recipients (async batch processing).
 * Max 100 recipients per request. Default 3s delay between messages.
 */
export async function sendBulk(
  messages: BulkMessageItem[],
  options?: BulkMessageOptions,
  sessionId?: string,
): Promise<BulkMessageResponse> {
  const sid = sessionId ?? config().defaultSessionId
  return openwaFetch(`/sessions/${sid}/messages/send-bulk`, {
    method: "POST",
    body: JSON.stringify({ messages, options }),
  })
}

// ─── Convenience Helpers ────────────────────────────────────────────────────

/**
 * Check if the default WhatsApp session is connected and ready to send messages.
 */
export async function isSessionReady(): Promise<boolean> {
  try {
    const session = await getSession()
    return session.status === "ready"
  } catch {
    return false
  }
}

// ─── Admin Alerts ───────────────────────────────────────────────────────────

/**
 * Get the admin's WhatsApp phone number from environment config.
 * Falls back to the admin email's local part (for development).
 */
export function getAdminPhone(): string | null {
  return getAdminPhones()[0] ?? null
}

/**
 * Get all admin WhatsApp phone numbers from environment config.
 * ADMIN_PHONE may be a single number or a comma-separated list — every
 * number in the list receives every admin alert (new sales, payment
 * anomalies, event/admin events, contact form, etc).
 */
export function getAdminPhones(): string[] {
  const raw = process.env.ADMIN_PHONE
  if (!raw) return []
  return raw
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean)
}

/**
 * Send a WhatsApp alert to every configured platform admin number.
 *
 * Safe to call from anywhere — silently skips if no admin phones are
 * configured or the session isn't ready. One admin's failed send doesn't
 * block delivery to the others.
 */
export async function sendAdminAlert(text: string): Promise<void> {
  const phones = getAdminPhones()
  if (phones.length === 0) {
    console.warn("[whatsapp] ADMIN_PHONE not set — skipping admin alert")
    log.warn("whatsapp — ADMIN_PHONE not set, skipping admin alert")
    return
  }

  try {
    const ready = await isSessionReady()
    if (!ready) {
      console.warn("[whatsapp] session not ready — skipping admin alert")
      log.warn("whatsapp — session not ready, skipping admin alert")
      return
    }
  } catch (err) {
    console.error("[whatsapp] failed to check session status:", err)
    log.error("whatsapp — failed to check session status", { error: err instanceof Error ? err.message : String(err) })
    return
  }

  await Promise.all(
    phones.map(async (phone) => {
      try {
        await sendText(formatChatId(phone), text)
      } catch (err) {
        console.error(`[whatsapp] failed to send admin alert to ${phone}:`, err)
        log.error("whatsapp — failed to send admin alert", { phone, error: err instanceof Error ? err.message : String(err) })
      }
    }),
  )
}
