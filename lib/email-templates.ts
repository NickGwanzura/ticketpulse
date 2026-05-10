/**
 * Plain-HTML transactional email templates.
 *
 * These intentionally avoid React/Tailwind so they render reliably in every
 * email client (Outlook included) without a render pipeline. Each template
 * returns both `html` and a plain-text fallback.
 *
 * SECURITY: every user-supplied string is run through `escape()` before it
 * is interpolated into HTML. Do not bypass this.
 */

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? "https://ticketpulse.tech"

const BRAND = {
  ink: "#0B1220",
  ink2: "#384151",
  ink3: "#6B7280",
  paper: "#FFFFFF",
  paper2: "#F6F9FC",
  line: "#E6ECF2",
  blue: "#2D6CDF",
  navy: "#0B1F4A",
} as const

function escape(s: string): string {
  return s.replace(/[<>&"']/g, (c) =>
    ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&#39;" }[c]!),
  )
}

function formatMoney(amount: number, currency: string): string {
  const localeMap: Record<string, string> = {
    USD: "en-US",
    ZWL: "en-ZW",
    ZAR: "en-ZA",
    GBP: "en-GB",
  }
  try {
    return new Intl.NumberFormat(localeMap[currency] ?? "en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount)
  } catch {
    return `${amount.toFixed(2)} ${currency}`
  }
}

type LayoutOpts = {
  preheader?: string
  heading: string
  body: string
  cta?: { label: string; href: string }
}

function layout({ preheader, heading, body, cta }: LayoutOpts): string {
  const previewBlock = preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escape(preheader)}</div>`
    : ""

  const ctaBlock = cta
    ? `
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0 8px;">
        <tr>
          <td>
            <a href="${escape(cta.href)}"
               style="display:inline-block;padding:12px 22px;border-radius:12px;background:${BRAND.navy};color:#FFFFFF;font-size:14px;font-weight:600;text-decoration:none;letter-spacing:-0.005em;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
              ${escape(cta.label)}
            </a>
          </td>
        </tr>
      </table>`
    : ""

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <meta name="x-apple-disable-message-reformatting" />
  <title>${escape(heading)}</title>
</head>
<body style="margin:0;padding:0;background:${BRAND.paper2};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${BRAND.ink};">
  ${previewBlock}
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:${BRAND.paper2};">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:560px;">
          <tr>
            <td style="padding-bottom:8px;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="vertical-align:middle;padding-right:10px;">
                    <div style="width:32px;height:32px;border-radius:8px;background:${BRAND.navy};text-align:center;line-height:32px;">
                      <span style="display:inline-block;width:6px;height:6px;border-radius:9999px;background:#FFFFFF;vertical-align:middle;"></span>
                    </div>
                  </td>
                  <td style="vertical-align:middle;">
                    <span style="font-size:18px;font-weight:700;letter-spacing:-0.01em;color:${BRAND.ink};">TicketPulse</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="background:${BRAND.paper};border:1px solid ${BRAND.line};border-radius:16px;padding:32px 28px;box-shadow:0 1px 2px rgba(11,18,32,0.04);">
              <h1 style="margin:0 0 12px;font-size:24px;font-weight:700;line-height:1.2;letter-spacing:-0.02em;color:${BRAND.ink};">
                ${escape(heading)}
              </h1>
              <div style="font-size:15px;line-height:24px;color:${BRAND.ink2};">
                ${body}
              </div>
              ${ctaBlock}
            </td>
          </tr>
          <tr>
            <td style="padding:20px 4px 0;">
              <hr style="border:none;border-top:1px solid ${BRAND.line};margin:0 0 16px;" />
              <p style="margin:0;font-size:12px;line-height:18px;color:${BRAND.ink3};">
                TicketPulse &middot; Harare, Zimbabwe &middot;
                <a href="${escape(APP_URL)}" style="color:${BRAND.ink2};text-decoration:underline;">ticketpulse.tech</a>
              </p>
              <p style="margin:6px 0 0;font-size:12px;line-height:18px;color:${BRAND.ink3};">
                You are receiving this because of activity on your TicketPulse account.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

// ─── Welcome ─────────────────────────────────────────────────────────────────

export function welcomeEmail(opts: { name?: string | null }): { html: string; text: string } {
  const first = opts.name?.split(" ")[0]?.trim()
  const heading = first ? `Welcome, ${first}.` : "Welcome to TicketPulse."
  const eventsUrl = `${APP_URL}/events`
  const body = `
    <p style="margin:0 0 14px;">
      You are in. TicketPulse is Zimbabwe&rsquo;s home for live events &mdash;
      concerts, marathons, film, and more. EcoCash and Visa, printable PDF
      tickets, mobile QR at the gate.
    </p>
    <p style="margin:0;">
      Start by browsing what is on. We will only email you when there is a
      real reason to.
    </p>`

  const html = layout({
    preheader: "Welcome to TicketPulse. One ticket, every event.",
    heading,
    body,
    cta: { label: "Browse events", href: eventsUrl },
  })

  const text = [
    heading,
    "",
    "You are in. TicketPulse is Zimbabwe's home for live events: concerts, marathons, film, and more.",
    "EcoCash and Visa, printable PDF tickets, mobile QR at the gate.",
    "",
    `Browse events: ${eventsUrl}`,
    "",
    "TicketPulse",
  ].join("\n")

  return { html, text }
}

// ─── Order receipt ───────────────────────────────────────────────────────────

export type OrderReceiptItem = {
  description: string
  qty: number
  price: number
}

export function orderReceiptEmail(opts: {
  orderId: string
  items: OrderReceiptItem[]
  total: number
  currency: string
  customerName?: string | null
}): { html: string; text: string } {
  const { orderId, items, total, currency, customerName } = opts
  const first = customerName?.split(" ")[0]?.trim()
  const heading = first ? `Thanks, ${first}.` : "Your TicketPulse order"
  const orderUrl = `${APP_URL}/orders/${encodeURIComponent(orderId)}`

  const rows = items
    .map(
      (i) => `
      <tr>
        <td style="padding:6px 0;color:${BRAND.ink2};font-size:13px;">
          ${i.qty}&times; ${escape(i.description)}
        </td>
        <td style="padding:6px 0;text-align:right;color:${BRAND.ink};font-size:13px;font-variant-numeric:tabular-nums;">
          ${escape(formatMoney(i.price * i.qty, currency))}
        </td>
      </tr>`,
    )
    .join("")

  const totalRow = `
    <tr>
      <td colspan="2"><hr style="border:none;border-top:1px solid ${BRAND.line};margin:10px 0;" /></td>
    </tr>
    <tr>
      <td style="font-size:14px;font-weight:700;color:${BRAND.ink};">Total</td>
      <td style="font-size:14px;font-weight:700;color:${BRAND.ink};text-align:right;font-variant-numeric:tabular-nums;">
        ${escape(formatMoney(total, currency))}
      </td>
    </tr>`

  const body = `
    <p style="margin:0 0 14px;">
      Receipt for order
      <strong style="color:${BRAND.ink};">#${escape(orderId)}</strong>.
      Your tickets are also waiting in your account.
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%"
           style="margin-top:16px;padding:18px;border:1px solid ${BRAND.line};border-radius:14px;background:${BRAND.paper2};">
      <tr>
        <td colspan="2" style="font-size:11px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:${BRAND.ink3};padding-bottom:8px;">
          Order
        </td>
      </tr>
      ${rows}
      ${totalRow}
      <tr>
        <td colspan="2" style="font-size:11px;color:${BRAND.ink3};padding-top:12px;letter-spacing:0.04em;">
          Order #${escape(orderId)}
        </td>
      </tr>
    </table>`

  const html = layout({
    preheader: `Receipt for order ${orderId}.`,
    heading,
    body,
    cta: { label: "View tickets", href: orderUrl },
  })

  const lines: string[] = [
    heading,
    "",
    `Order #${orderId}`,
    "",
    ...items.map(
      (i) =>
        `${i.qty} x ${i.description}  :  ${formatMoney(i.price * i.qty, currency)}`,
    ),
    "",
    `Total: ${formatMoney(total, currency)}`,
    "",
    `View tickets: ${orderUrl}`,
    "",
    "TicketPulse",
  ]

  return { html, text: lines.join("\n") }
}

// ─── Vendor enquiry forwarding ───────────────────────────────────────────────

export function vendorEnquiryEmail(opts: {
  vendorName: string
  customerName: string
  customerEmail: string
  customerPhone?: string | null
  eventDate?: string | null
  guestCount?: string | number | null
  message: string
}): { html: string; text: string } {
  const {
    vendorName,
    customerName,
    customerEmail,
    customerPhone,
    eventDate,
    guestCount,
    message,
  } = opts

  const heading = `New enquiry for ${vendorName}`

  const detail = (label: string, value: string) => `
    <tr>
      <td style="padding:6px 12px 6px 0;font-size:12px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;color:${BRAND.ink3};white-space:nowrap;vertical-align:top;">
        ${escape(label)}
      </td>
      <td style="padding:6px 0;font-size:14px;color:${BRAND.ink};vertical-align:top;">
        ${value}
      </td>
    </tr>`

  const detailRows = [
    detail("From", escape(customerName)),
    detail(
      "Email",
      `<a href="mailto:${escape(customerEmail)}" style="color:${BRAND.blue};text-decoration:underline;">${escape(customerEmail)}</a>`,
    ),
    customerPhone ? detail("Phone", escape(customerPhone)) : "",
    eventDate ? detail("Event date", escape(eventDate)) : "",
    guestCount != null && guestCount !== ""
      ? detail("Guest count", escape(String(guestCount)))
      : "",
  ]
    .filter(Boolean)
    .join("")

  const body = `
    <p style="margin:0 0 14px;">
      You have a new enquiry on TicketPulse. Reply directly to this email to
      reach <strong style="color:${BRAND.ink};">${escape(customerName)}</strong>.
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%"
           style="margin:16px 0 8px;padding:18px;border:1px solid ${BRAND.line};border-radius:14px;background:${BRAND.paper2};">
      ${detailRows}
      <tr>
        <td colspan="2" style="padding-top:14px;">
          <div style="font-size:12px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;color:${BRAND.ink3};margin-bottom:6px;">
            Message
          </div>
          <div style="font-size:14px;line-height:22px;color:${BRAND.ink};white-space:pre-wrap;">
${escape(message)}
          </div>
        </td>
      </tr>
    </table>
    <p style="margin:14px 0 0;font-size:12px;color:${BRAND.ink3};">
      Reply directly to this email to reach ${escape(customerName)}.
    </p>`

  const html = layout({
    preheader: `New enquiry from ${customerName}.`,
    heading,
    body,
  })

  const textLines: string[] = [
    heading,
    "",
    `From: ${customerName} <${customerEmail}>`,
  ]
  if (customerPhone) textLines.push(`Phone: ${customerPhone}`)
  if (eventDate) textLines.push(`Event date: ${eventDate}`)
  if (guestCount != null && guestCount !== "") textLines.push(`Guest count: ${guestCount}`)
  textLines.push("", "Message:", message, "", `Reply directly to ${customerEmail}.`)

  return { html, text: textLines.join("\n") }
}

// ─── Magic-link (used by next-auth Resend provider) ──────────────────────────

export function magicLinkEmail(opts: { url: string; host: string }): {
  html: string
  text: string
} {
  const { url, host } = opts
  const heading = "Sign in to TicketPulse"
  const body = `
    <p style="margin:0 0 14px;">
      Click the button below to finish signing in to
      <strong style="color:${BRAND.ink};">${escape(host)}</strong>.
      The link is good for a few minutes.
    </p>
    <p style="margin:0 0 14px;font-size:13px;color:${BRAND.ink3};">
      If you did not request this, you can safely ignore this email.
    </p>`

  const html = layout({
    preheader: `Sign in to ${host}.`,
    heading,
    body,
    cta: { label: "Sign in", href: url },
  })

  const text = [
    heading,
    "",
    `Open this link to finish signing in to ${host}:`,
    url,
    "",
    "If you did not request this, you can ignore this email.",
    "",
    "TicketPulse",
  ].join("\n")

  return { html, text }
}
