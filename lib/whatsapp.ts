import "server-only"

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
  const digits = phone.replace(/\D/g, "")
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
  return process.env.ADMIN_PHONE ?? null
}

/**
 * Send a WhatsApp alert to the platform admin.
 *
 * Safe to call from anywhere — silently skips if admin phone isn't configured
 * or the session isn't ready.
 */
export async function sendAdminAlert(text: string): Promise<void> {
  const phone = getAdminPhone()
  if (!phone) {
    console.warn("[whatsapp] ADMIN_PHONE not set — skipping admin alert")
    return
  }

  try {
    const ready = await isSessionReady()
    if (!ready) {
      console.warn("[whatsapp] session not ready — skipping admin alert")
      return
    }

    await sendText(formatChatId(phone), text)
  } catch (err) {
    console.error("[whatsapp] failed to send admin alert:", err)
  }
}
