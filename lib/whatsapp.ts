import "server-only"
import { randomUUID } from "node:crypto"
import { log } from "@/lib/logger"
import { uploadPublicObject } from "@/lib/r2"

type OpenWAConfig = {
  baseUrl: string
  apiKey: string
  defaultSessionId: string
}

type WhatsAppProvider = "openwa" | "wacrm"

type WacrmConfig = {
  baseUrl: string
  apiKey: string
}

type WacrmMessageResponse = {
  message_id?: string
  whatsapp_message_id?: string
  created_at?: string
}

function provider(): WhatsAppProvider {
  const value = (process.env.WHATSAPP_PROVIDER ?? "openwa").trim().toLowerCase()
  if (value === "openwa" || value === "wacrm") return value
  throw new Error(`Unsupported WhatsApp provider "${value}". Use "openwa" or "wacrm".`)
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

function wacrmConfig(): WacrmConfig {
  const baseUrl = process.env.WACRM_URL
  const apiKey = process.env.WACRM_API_KEY
  if (!baseUrl || !apiKey) {
    throw new Error("Missing WACRM configuration. Set WACRM_URL and WACRM_API_KEY in the environment.")
  }
  return { baseUrl, apiKey }
}

function wacrmApiBase(): string {
  const { baseUrl } = wacrmConfig()
  const root = baseUrl.replace(/\/+$/, "")
  return root.endsWith("/api/v1") ? root : `${root}/api/v1`
}

async function wacrmFetch<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
  const { apiKey } = wacrmConfig()
  const res = await fetch(`${wacrmApiBase()}${path}`, {
    ...options,
    signal: options.signal ?? AbortSignal.timeout(20_000),
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      ...options.headers,
    },
  })

  const payload = await res.json().catch(() => null) as {
    data?: T
    error?: { code?: string; message?: string }
  } | null

  if (!res.ok || payload?.error) {
    const code = payload?.error?.code ? ` ${payload.error.code}` : ""
    const message = payload?.error?.message ?? `HTTP ${res.status}`
    throw new Error(`WACRM API error${code}: ${message}`)
  }

  return (payload?.data ?? payload) as T
}

function toE164(chatId: string): string {
  let digits = chatId.replace(/@[^@]+$/, "").replace(/\D/g, "")
  const countryCode = (process.env.WHATSAPP_COUNTRY_CODE ?? "263").replace(/\D/g, "")
  if (digits.startsWith("00")) digits = digits.slice(2)
  if (digits.startsWith("0")) digits = `${countryCode}${digits.slice(1)}`
  else if (digits.length === 9 && digits.startsWith("7")) digits = `${countryCode}${digits}`
  if (!digits) throw new Error("WhatsApp recipient phone number is empty")
  return `+${digits}`
}

function messageResult(data: WacrmMessageResponse): SendTextResponse {
  return {
    messageId: data.message_id ?? data.whatsapp_message_id ?? `wacrm-${randomUUID()}`,
    timestamp: data.created_at ? Date.parse(data.created_at) || Date.now() : Date.now(),
  }
}

async function wacrmMediaUrl(options: SendMediaOptions, extension: string): Promise<string> {
  if (options.url) return options.url
  if (!options.base64) throw new Error("WACRM media requires a public URL or base64 payload")
  const contentType = options.mimetype ?? "application/octet-stream"
  const key = `whatsapp/wacrm/${new Date().toISOString().slice(0, 10)}/${randomUUID()}.${extension}`
  return uploadPublicObject({
    key,
    body: Buffer.from(options.base64, "base64"),
    contentType,
  })
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
  if (provider() === "wacrm") {
    const account = await wacrmFetch<{ id?: string; name?: string }>("/me")
    return {
      id: account.id ?? "wacrm",
      name: account.name ?? "WACRM",
      status: "ready",
      phone: null,
      pushName: null,
      connectedAt: null,
      lastActive: new Date().toISOString(),
    }
  }
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
  if (provider() === "wacrm") {
    const data = await wacrmFetch<WacrmMessageResponse>("/messages", {
      method: "POST",
      body: JSON.stringify({ to: toE164(chatId), type: "text", text }),
    })
    return messageResult(data)
  }
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
  if (provider() === "wacrm") {
    const mediaUrl = await wacrmMediaUrl(options, "jpg")
    const data = await wacrmFetch<WacrmMessageResponse>("/messages", {
      method: "POST",
      body: JSON.stringify({
        to: toE164(options.chatId),
        type: "image",
        media_url: mediaUrl,
        text: options.caption,
        filename: options.filename,
      }),
    })
    return messageResult(data)
  }
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
  if (provider() === "wacrm") {
    const mediaUrl = await wacrmMediaUrl(options, "pdf")
    const data = await wacrmFetch<WacrmMessageResponse>("/messages", {
      method: "POST",
      body: JSON.stringify({
        to: toE164(options.chatId),
        type: "document",
        media_url: mediaUrl,
        text: options.caption,
        filename: options.filename,
      }),
    })
    return messageResult(data)
  }
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
  if (provider() !== "openwa") {
    throw new Error("WhatsApp bulk messaging is available only when WHATSAPP_PROVIDER is set to openwa")
  }
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
