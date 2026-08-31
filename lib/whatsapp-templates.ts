import "server-only"
import { getBaseUrl } from "@/lib/url-config"

// ─── Brand Configuration ─────────────────────────────────────────────────────
// Update these to match your brand identity.

const BRAND = {
  name: "TicketPulse",
  tagline: "Your events, delivered.",
  get appUrl(): string { return getBaseUrl() },
  get iconUrl(): string { return `${getBaseUrl()}/favicon.jpg` },
  support: "https://wa.me/263788689923",
} as const

function footer(isAdmin: boolean): string {
  if (isAdmin) {
    return `\n${BRAND.name} Admin · ${BRAND.appUrl}/admin`
  }
  return `\n${BRAND.name} · ${BRAND.appUrl}\nSupport: ${BRAND.support}`
}

// ─── Admin Alerts ────────────────────────────────────────────────────────────

export function eventPublishedAlert(title: string, eventDate: string, eventUrl: string): string {
  return [
    `*Event Published*`,
    ``,
    title,
    eventDate,
    eventUrl,
    footer(true),
  ].join("\n")
}

export function newPaymentAlert(
  eventTitle: string,
  amount: string,
  currency: string,
  buyerName: string,
  buyerPhone: string,
  paymentMethod: string,
  orderId: string,
  invoiceId: string,
): string {
  return [
    `*New Payment — ${currency} ${amount}*`,
    ``,
    eventTitle,
    `Buyer: ${buyerName}`,
    buyerPhone !== "—" ? `Phone: ${buyerPhone}` : null,
    `Method: ${paymentMethod.toUpperCase()}`,
    `Order: #${orderId.slice(0, 8)}`,
    `Invoice: ${invoiceId}`,
    footer(true),
  ]
    .filter(Boolean)
    .join("\n")
}

export function freeOrderAlert(
  eventTitle: string,
  buyerName: string,
  buyerPhone: string,
  orderId: string,
): string {
  return [
    `*Free Order Processed*`,
    ``,
    eventTitle,
    `Buyer: ${buyerName}`,
    buyerPhone ? `Phone: ${buyerPhone}` : null,
    `Order: #${orderId.slice(0, 8)}`,
    `Amount: $0.00 (promo / free)`,
    footer(true),
  ]
    .filter(Boolean)
    .join("\n")
}

export function contactFormAlert(name: string, email: string, topic: string | null, message: string): string {
  return [
    `*New Contact Form Message*`,
    ``,
    `From: ${name} (${email})`,
    topic ? `Topic: ${topic}` : null,
    ``,
    message.length > 500 ? message.slice(0, 500) + "…" : message,
    footer(true),
  ]
    .filter(Boolean)
    .join("\n")
}

export function newEventAlert(
  title: string,
  category: string,
  city: string,
  startsAt: string,
): string {
  return [
    `*New Event Created*`,
    ``,
    title,
    `Category: ${category}`,
    `City: ${city}`,
    `Date: ${startsAt}`,
    footer(true),
  ]
    .filter(Boolean)
    .join("\n")
}

export function newSignupAlert(name: string, email: string, role: string): string {
  return [
    `*New Signup — ${role}*`,
    ``,
    name,
    email,
    `Role: ${role}`,
    footer(true),
  ]
    .filter(Boolean)
    .join("\n")
}

export function paymentAnomalyAlert(
  title: string,
  orderId: string | null | undefined,
  type: string,
  detail: string,
): string {
  return [
    `*Payment review required*`,
    ``,
    title,
    orderId ? `Order: ${orderId}` : null,
    `Type: ${type}`,
    detail.length > 320 ? detail.slice(0, 320) + "…" : detail,
    orderId ? `Review: ${BRAND.appUrl}/admin/orders/${orderId}` : null,
    footer(true),
  ]
    .filter(Boolean)
    .join("\n")
}

// ─── End-User Messages ───────────────────────────────────────────────────────

export function ticketConfirmationMessage(
  eventTitle: string,
  buyerName: string,
  eventDate: string,
  venue: string | null,
  orderId: string,
  itemsSummary: string,
  ticketUrl: string,
): string {
  return [
    `*Your tickets are confirmed!*`,
    ``,
    `Hi ${buyerName}, you're going to *${eventTitle}*.`,
    ``,
    `Date: ${eventDate}`,
    venue ? `Venue: ${venue}` : null,
    `Order: #${orderId.slice(0, 8)}`,
    ``,
    itemsSummary ? `${itemsSummary}` : null,
    ``,
    `View tickets: ${ticketUrl}`,
    ``,
    `Show the QR code at the door. See you there!`,
    footer(false),
  ]
    .filter(Boolean)
    .join("\n")
}

export function organizerSaleNotification(
  eventTitle: string,
  buyerName: string,
  orderId: string,
  itemsLines: string[],
  total: string,
  currency: string,
  organizerUrl: string,
): string {
  return [
    `*New Sale — ${eventTitle}*`,
    ``,
    `Buyer: ${buyerName}`,
    `Order: #${orderId.slice(0, 8)}`,
    ...itemsLines,
    `Total: ${currency} ${total}`,
    ``,
    `Attendees: ${organizerUrl}`,
    footer(false),
  ]
    .filter(Boolean)
    .join("\n")
}
