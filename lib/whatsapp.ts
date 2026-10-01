import "server-only"
import { randomUUID } from "node:crypto"
import { log } from "@/lib/logger"
import { uploadPublicObject } from "@/lib/r2"

type GupshupConfig = {
  apiKey: string
  appId: string
  appName: string
  source: string
}

type GupshupMessageResponse = {
  status?: string
  messageId?: string
  message?: string
  timestamp?: string | number
}

function gupshupConfig(): GupshupConfig {
  const apiKey = process.env.GUPSHUP_API_KEY?.trim()
  const appId = process.env.GUPSHUP_APP_ID?.trim()
  const appName = process.env.GUPSHUP_APP_NAME?.trim()
  const rawSource = process.env.GUPSHUP_SOURCE?.trim()

  if (!apiKey || !appId || !appName || !rawSource) {
    throw new Error("Missing Gupshup configuration. Set GUPSHUP_API_KEY, GUPSHUP_APP_ID, GUPSHUP_APP_NAME, and GUPSHUP_SOURCE.")
  }

  return { apiKey, appId, appName, source: toGupshupNumber(rawSource) }
}

function countryCode(): string {
  return (process.env.WHATSAPP_COUNTRY_CODE ?? "263").replace(/\D/g, "")
}

function toGupshupNumber(value: string): string {
  let digits = value.trim().replace(/^whatsapp:/i, "").replace(/@[^@]+$/, "").replace(/\D/g, "")
  if (digits.startsWith("00")) digits = digits.slice(2)
  if (digits.startsWith("0")) digits = `${countryCode()}${digits.slice(1)}`
  else if (digits.length === 9 && digits.startsWith("7")) digits = `${countryCode()}${digits}`

  if (digits.length < 8 || digits.length > 15) {
    throw new Error("WhatsApp phone number must be a valid international number.")
  }
  return digits
}

/**
 * Keep the app's stable WhatsApp chat key format while translating phone
 * numbers to Gupshup's digits-only E.164 form at the provider boundary.
 *
 * @example formatChatId("+263 77 123 4567") // "263771234567@c.us"
 * @example formatChatId("0771234567")        // "263771234567@c.us"
 */
export function formatChatId(phone: string): string {
  return `${toGupshupNumber(phone)}@c.us`
}

async function gupshupFetch<T>(url: string, options: RequestInit = {}): Promise<T> {
  const { apiKey } = gupshupConfig()
  const headers = new Headers(options.headers)
  headers.set("apikey", apiKey)
  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/x-www-form-urlencoded")
  }

  const response = await fetch(url, {
    ...options,
    headers,
    signal: options.signal ?? AbortSignal.timeout(20_000),
  })
  const payload = await response.json().catch(() => null) as (T & GupshupMessageResponse) | null
  if (!response.ok || payload?.status === "error") {
    throw new Error(`Gupshup API error: ${payload?.message ?? `HTTP ${response.status}`}`)
  }
  if (!payload) throw new Error("Gupshup API returned an empty response")
  return payload
}

function messageResult(data: GupshupMessageResponse): SendTextResponse {
  const timestamp = typeof data.timestamp === "number"
    ? data.timestamp
    : typeof data.timestamp === "string"
      ? Date.parse(data.timestamp)
      : Number.NaN

  return {
    messageId: data.messageId ?? `gupshup-${randomUUID()}`,
    timestamp: Number.isFinite(timestamp) && timestamp > 0 ? timestamp : Date.now(),
  }
}

function messageForm(destination: string, message: Record<string, unknown>): URLSearchParams {
  const config = gupshupConfig()
  return new URLSearchParams({
    channel: "whatsapp",
    source: config.source,
    destination: toGupshupNumber(destination),
    message: JSON.stringify(message),
    "src.name": config.appName,
  })
}

async function sendMessage(destination: string, message: Record<string, unknown>): Promise<SendTextResponse> {
  const data = await gupshupFetch<GupshupMessageResponse>("https://api.gupshup.io/wa/api/v1/msg", {
    method: "POST",
    body: messageForm(destination, message),
  })
  return messageResult(data)
}

async function publicMediaUrl(options: SendMediaOptions, extension: string): Promise<string> {
  if (options.url) return options.url
  if (!options.base64) throw new Error("Gupshup media requires a public URL or base64 payload")

  const key = `whatsapp/gupshup/${new Date().toISOString().slice(0, 10)}/${randomUUID()}.${extension}`
  return uploadPublicObject({
    key,
    body: Buffer.from(options.base64, "base64"),
    contentType: options.mimetype ?? "application/octet-stream",
  })
}

// ─── Connection status ──────────────────────────────────────────────────────

export type SessionStatus = "created" | "initializing" | "qr_ready" | "authenticating" | "ready" | "disconnected" | "failed"

export type SessionInfo = {
  id: string
  name: string
  status: SessionStatus
  phone: string | null
  pushName: string | null
  connectedAt: string | null
  lastActive: string | null
}

/** Verify the configured Gupshup app credentials and return its sender info. */
export async function getSession(): Promise<SessionInfo> {
  const config = gupshupConfig()
  const response = await gupshupFetch<{
    status?: string
    business?: { name?: string; contactNumber?: string; id?: string }
  }>(`https://api.gupshup.io/wa/app/${encodeURIComponent(config.appId)}/business`)

  if (response.status !== "success" || !response.business) {
    throw new Error("Gupshup did not return an active WhatsApp app profile")
  }

  return {
    id: response.business.id ?? config.appId,
    name: response.business.name ?? config.appName,
    status: "ready",
    phone: `+${config.source}`,
    pushName: null,
    connectedAt: null,
    lastActive: new Date().toISOString(),
  }
}

// ─── Send Text ───────────────────────────────────────────────────────────────

export type SendTextResponse = {
  messageId: string
  timestamp: number
}

/** Send a text message through the single configured Gupshup WhatsApp app. */
export async function sendText(chatId: string, text: string): Promise<SendTextResponse> {
  return sendMessage(chatId, { type: "text", text })
}

// ─── Send Media ──────────────────────────────────────────────────────────────

export type SendMediaOptions = {
  chatId: string
  /** Public URL of the media */
  url?: string
  /** Base64-encoded media data (uploaded to R2 before sending) */
  base64?: string
  /** MIME type (required when using base64) */
  mimetype?: string
  /** Optional caption */
  caption?: string
  /** Optional filename */
  filename?: string
}

/** Send an image through Gupshup. Gupshup fetches the media from its public URL. */
export async function sendImage(options: SendMediaOptions): Promise<SendTextResponse> {
  const extension = options.filename?.split(".").pop() || (options.mimetype === "image/png" ? "png" : "jpg")
  const url = await publicMediaUrl(options, extension)
  return sendMessage(options.chatId, {
    type: "image",
    originalUrl: url,
    previewUrl: url,
    ...(options.caption ? { caption: options.caption } : {}),
  })
}

/** Send a document (including ticket PDFs) through Gupshup. */
export async function sendDocument(options: SendMediaOptions): Promise<SendTextResponse> {
  const extension = options.filename?.split(".").pop() || "pdf"
  const url = await publicMediaUrl(options, extension)
  return sendMessage(options.chatId, {
    type: "file",
    url,
    filename: options.filename ?? `ticket.${extension}`,
    ...(options.caption ? { caption: options.caption } : {}),
  })
}

/** Check that the configured Gupshup app credentials still reach its business profile. */
export async function isSessionReady(): Promise<boolean> {
  try {
    return (await getSession()).status === "ready"
  } catch {
    return false
  }
}

// ─── Admin Alerts ────────────────────────────────────────────────────────────

/** Get the primary admin WhatsApp number from environment config. */
export function getAdminPhone(): string | null {
  return getAdminPhones()[0] ?? null
}

/** Get all admin WhatsApp numbers; a comma-separated list is supported. */
export function getAdminPhones(): string[] {
  const raw = process.env.ADMIN_PHONE
  if (!raw) return []
  return raw.split(",").map((phone) => phone.trim()).filter(Boolean)
}

/** Send a WhatsApp alert to every configured platform admin number. */
export async function sendAdminAlert(text: string): Promise<void> {
  const phones = getAdminPhones()
  if (phones.length === 0) {
    log.warn("whatsapp — ADMIN_PHONE not set, skipping admin alert")
    return
  }

  if (!await isSessionReady()) {
    log.warn("whatsapp — Gupshup app is not ready, skipping admin alert")
    return
  }

  await Promise.all(phones.map(async (phone) => {
    try {
      await sendText(formatChatId(phone), text)
    } catch (error) {
      log.error("whatsapp — failed to send admin alert", {
        phone,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }))
}
