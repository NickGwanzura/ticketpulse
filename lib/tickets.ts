import "server-only"
import { createHash } from "node:crypto"
import QRCode from "qrcode"
import { generateTicketPdfBuffer } from "@/lib/pdf/generate"
import type { TicketPageData } from "@/lib/pdf/ticket-document"

export type TicketPdfParams = {
  eventTitle: string
  tierName: string
  buyerName: string
  orderId: string
  ticketId: string
  qrCodeData: string
}

/**
 * Generate a QR code data URL from an identifier string.
 * The QR encodes a verification URL for the ticket.
 */
export async function generateQrDataUrl(
  ticketId: string,
  orderId: string,
  baseUrl?: string,
): Promise<string> {
  const verifyUrl = generateTicketVerifyUrl(ticketId, orderId, baseUrl)
  return QRCode.toDataURL(verifyUrl, { width: 200, margin: 2 })
}

export function generateTicketVerifyUrl(
  ticketId: string,
  orderId: string,
  baseUrl?: string,
): string {
  const origin = baseUrl ?? process.env.NEXT_PUBLIC_APP_URL ?? "https://ticketplse.tech"
  return `${origin}/tickets/${ticketId}/verify?order=${orderId}`
}

export async function generateQrDataUrlFromValue(value: string): Promise<string> {
  return QRCode.toDataURL(value, { width: 200, margin: 2 })
}

export async function generateTicketQrImageDataUrl(
  storedQrCode: string | null | undefined,
  ticketId: string,
  orderId: string,
  baseUrl?: string,
): Promise<string> {
  if (storedQrCode?.startsWith("data:image")) return storedQrCode
  const value = storedQrCode || generateTicketVerifyUrl(ticketId, orderId, baseUrl)
  return generateQrDataUrlFromValue(value)
}

export function deterministicTicketId(orderId: string, orderItemId: string, index: number): string {
  const bytes = createHash("sha256")
    .update(`ticket:${orderId}:${orderItemId}:${index}`)
    .digest()
    .subarray(0, 16)

  bytes[6] = (bytes[6] & 0x0f) | 0x50
  bytes[8] = (bytes[8] & 0x3f) | 0x80

  const hex = bytes.toString("hex")
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

/**
 * Generate a combined PDF containing all tickets in the order.
 * Each ticket gets one A6 page in a multi-page document.
 * Uses @react-pdf/renderer for reliable server-side rendering.
 */
export async function generateCombinedTicketPdf(
  tickets: TicketPdfParams[],
): Promise<Buffer> {
  if (tickets.length === 0) {
    return generateTicketPdfBuffer([])
  }

  const pages: TicketPageData[] = tickets.map((t, idx) => ({
    eventTitle: t.eventTitle,
    tierName: t.tierName,
    buyerName: t.buyerName,
    orderId: t.orderId,
    ticketId: t.ticketId,
    qrCodeDataUrl: t.qrCodeData,
    humanCode: `${t.orderId.slice(-6)}-${(idx + 1).toString().padStart(2, "0")}`,
    venue: undefined,
    eventDate: null,
  }))

  return generateTicketPdfBuffer(pages)
}

/**
 * Generate a single ticket PDF (backwards compatible).
 */
export async function generateTicketPdf(params: {
  eventTitle: string
  tierName: string
  buyerName: string
  orderId: string
  ticketId: string
  qrCode: string
}): Promise<Buffer> {
  return generateCombinedTicketPdf([
    {
      eventTitle: params.eventTitle,
      tierName: params.tierName,
      buyerName: params.buyerName,
      orderId: params.orderId,
      ticketId: params.ticketId,
      qrCodeData: params.qrCode,
    },
  ])
}
