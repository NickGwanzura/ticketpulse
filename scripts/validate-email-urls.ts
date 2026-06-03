/**
 * Validates that all email templates produce URLs pointing to the correct
 * production domain (ticketplse.tech), not localhost or a Railway subdomain.
 *
 * Usage: NODE_ENV=production npx tsx scripts/validate-email-urls.ts
 *
 * Set NODE_ENV=production so the code uses the hardcoded fallback URLs rather
 * than any local .env overrides.
 */

import { render } from "@react-email/render"

// ── React email templates ────────────────────────────────────────────────
import VerifyPurchaseEmail from "@/emails/verify-purchase"
import MagicLinkEmail from "@/emails/magic-link"
import ResetPasswordEmail from "@/emails/reset-password"
import WelcomeEmail from "@/emails/welcome"
import OrderConfirmationEmail from "@/emails/order-confirmation"
import AdminInviteEmail from "@/emails/admin-invite"
import PayoutNotificationEmail from "@/emails/payout-notification"

// ── Plain-HTML email templates ───────────────────────────────────────────
import {
  welcomeEmail,
  orderReceiptEmail,
  saleNotificationEmail,
  eventPublishedNotificationEmail,
  magicLinkEmail,
  vendorEnquiryEmail,
  organiserInviteEmail,
  announcementEmail,
} from "@/lib/email-templates"

// ── Helpers ──────────────────────────────────────────────────────────────

const PRODUCTION_DOMAIN = "ticketplse.tech"

/**
 * Extract all URL-like strings from HTML/text content.
 */
function findUrls(content: string): string[] {
  const urls: string[] = []

  // Match href attribute values
  const hrefPattern = /href="([^"]+)"/g
  let match: RegExpExecArray | null
  while ((match = hrefPattern.exec(content)) !== null) {
    urls.push(match[1])
  }

  // Match src attribute values
  const srcPattern = /src="([^"]+)"/g
  while ((match = srcPattern.exec(content)) !== null) {
    urls.push(match[1])
  }

  // Match plain http/https URLs in text (including in plain-text fallbacks)
  const urlPattern = /https?:\/\/[^\s<>"']+/g
  while ((match = urlPattern.exec(content)) !== null) {
    urls.push(match[0])
  }

  return urls
}

/**
 * Check a list of URLs for localhost or wrong-domain references.
 * Returns an array of issues found.
 */
function checkUrls(urls: string[], templateName: string): string[] {
  const issues: string[] = []
  const seen = new Set<string>()

  for (const rawUrl of urls) {
    // Deduplicate
    const key = rawUrl
    if (seen.has(key)) continue
    seen.add(key)

    try {
      const parsed = new URL(rawUrl)

      // Allow relative URLs (no host) — they're fine
      if (!parsed.hostname) continue

      // Allow the app URL (whatever it's set to in env, or the fallback)
      if (parsed.hostname === PRODUCTION_DOMAIN) continue

      // Allow well-known external services
      const allowedHosts = [
        "images.unsplash.com",
        "res.cloudinary.com",
        "fonts.googleapis.com",
        "fonts.gstatic.com",
      ]
      if (allowedHosts.some((h) => parsed.hostname.endsWith(h))) continue

      // Allow protocol-relative URLs like //images.unsplash.com
      if (!parsed.protocol.startsWith("http")) continue

      // Flag it
      issues.push(
        `  ❌ ${templateName}: unexpected host "${parsed.hostname}" in URL: ${rawUrl}`,
      )
    } catch {
      // Ignore unparseable strings that looked like URLs
    }
  }

  return issues
}

/**
 * Run all checks and collect issues.
 */
async function run(): Promise<string[]> {
  const allIssues: string[] = []

  // ── Test data ──────────────────────────────────────────────────────────
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? `https://${PRODUCTION_DOMAIN}`
  const sampleOrderId = "550e8400-e29b-41d4-a716-446655440000"

  // ── Plain-HTML Templates ───────────────────────────────────────────────
  const htmlTests: [string, { html: string; text: string }][] = [
    ["welcomeEmail", welcomeEmail({ name: "Test User" })],
    [
      "orderReceiptEmail",
      orderReceiptEmail({
        orderId: sampleOrderId,
        items: [{ description: "General Admission", qty: 2, price: 25 }],
        total: 50,
        currency: "USD",
        customerName: "Test User",
      }),
    ],
    [
      "saleNotificationEmail (organizer)",
      saleNotificationEmail({
        role: "organizer",
        eventTitle: "Test Event",
        buyerName: "Test Buyer",
        orderId: sampleOrderId,
        items: [{ label: "General Admission", qty: 2, amount: "$25.00" }],
        total: "50.00",
        currency: "USD",
        organizerName: "Test Org",
      }),
    ],
    [
      "saleNotificationEmail (admin)",
      saleNotificationEmail({
        role: "admin",
        eventTitle: "Test Event",
        buyerName: "Test Buyer",
        orderId: sampleOrderId,
        items: [{ label: "General Admission", qty: 2, amount: "$25.00" }],
        total: "50.00",
        currency: "USD",
      }),
    ],
    [
      "eventPublishedNotificationEmail",
      eventPublishedNotificationEmail({
        eventTitle: "Test Event",
        eventDate: "Monday, 1 January 2025",
        eventUrl: `${appUrl}/events/test-event`,
        organizerName: "Test Org",
      }),
    ],
    [
      "magicLinkEmail",
      magicLinkEmail({
        url: `${appUrl}/api/auth/callback/resend?callbackUrl=${encodeURIComponent(`${appUrl}/api/orders/${sampleOrderId}/finalize`)}&token=test-token-123`,
        host: PRODUCTION_DOMAIN,
      }),
    ],
    [
      "vendorEnquiryEmail",
      vendorEnquiryEmail({
        vendorName: "Test Vendor",
        customerName: "Test Customer",
        customerEmail: "customer@example.com",
        customerPhone: "+263700000000",
        eventDate: "Monday, 1 January 2025",
        guestCount: 10,
        message: "Looking forward to it!",
      }),
    ],
    [
      "organiserInviteEmail",
      organiserInviteEmail({
        inviterName: "Admin User",
        eventTitle: "Test Event",
        inviteUrl: `${appUrl}/auth/signin?email=test@example.com`,
        email: "test@example.com",
      }),
    ],
    [
      "announcementEmail",
      announcementEmail({ name: "Test User" }),
    ],
  ]

  console.log("\n🔍 Checking plain-HTML email templates...\n")
  for (const [name, { html, text }] of htmlTests) {
    const allContent = html + "\n" + text
    const urls = findUrls(allContent)
    console.log(`  📧 ${name}: ${urls.length} URLs found`)
    const issues = checkUrls(urls, name)
    allIssues.push(...issues)
  }

  // ── React Email Templates ──────────────────────────────────────────────
  console.log("\n🔍 Checking React email templates...\n")

  const reactTests: [string, React.ReactElement][] = [
    [
      "VerifyPurchaseEmail",
      VerifyPurchaseEmail({
        url: `${appUrl}/api/auth/callback/resend?callbackUrl=${encodeURIComponent(`${appUrl}/api/orders/${sampleOrderId}/finalize`)}&token=test-token-123`,
        eventTitle: "Test Event",
        amount: "50.00",
        currency: "USD",
      }),
    ],
    [
      "MagicLinkEmail",
      MagicLinkEmail({
        url: `${appUrl}/api/auth/callback/resend?callbackUrl=${encodeURIComponent(`${appUrl}/dashboard`)}&token=test-token-123`,
        host: PRODUCTION_DOMAIN,
      }),
    ],
    [
      "ResetPasswordEmail",
      ResetPasswordEmail({
        name: "Test User",
        resetUrl: `${appUrl}/auth/reset-password?token=test-token-123`,
      }),
    ],
    [
      "WelcomeEmail",
      WelcomeEmail({ name: "Test User" }),
    ],
    [
      "OrderConfirmationEmail",
      OrderConfirmationEmail({
        buyerName: "Test User",
        orderId: sampleOrderId,
        eventTitle: "Test Event",
        eventDate: "Monday, 1 January 2025",
        eventVenue: "Test Venue, Harare",
        lines: [{ label: "General Admission", qty: 2, amount: "$50.00" }],
        total: "50.00",
        currency: "USD",
        ticketUrl: `${appUrl}/orders/${sampleOrderId}`,
      }),
    ],
    [
      "AdminInviteEmail",
      AdminInviteEmail({
        role: "organizer",
        inviteUrl: `${appUrl}/auth/signin?email=test@example.com`,
        inviterName: "Admin User",
      }),
    ],
    [
      "PayoutNotificationEmail",
      PayoutNotificationEmail({
        organizerName: "Test Organizer",
        payoutId: "payout-123",
        amount: "150.00",
        currency: "USD",
        method: "EcoCash",
        destination: "077xxxxxxx",
        eventTitle: "Test Event",
      }),
    ],
  ]

  for (const [name, element] of reactTests) {
    try {
      const html = render(element)
      const urls = findUrls(html)
      console.log(`  📧 ${name}: ${urls.length} URLs found`)
      const issues = checkUrls(urls, name)
      allIssues.push(...issues)
    } catch (err) {
      allIssues.push(`  ❌ ${name}: failed to render — ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  return allIssues
}

// ── Main ─────────────────────────────────────────────────────────────────

run()
  .then((issues) => {
    console.log("\n" + "=".repeat(60))
    if (issues.length === 0) {
      console.log("✅ ALL EMAIL URLS ARE CORRECT — no localhost or wrong-domain leaks found.\n")
      process.exit(0)
    } else {
      console.log(`❌ ${issues.length} issue(s) found:\n`)
      for (const issue of issues) {
        console.log(issue)
      }
      console.log()
      process.exit(1)
    }
  })
  .catch((err) => {
    console.error("Script failed:", err)
    process.exit(1)
  })
