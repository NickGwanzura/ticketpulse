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
                    <img src="${escape(APP_URL)}/logo.svg" alt="TicketPulse" width="32" height="32" style="display:block;outline:none;border:none;border-radius:6px;" />
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

// ─── Organizer approved ───────────────────────────────────────────────────────

export function organizerApprovedEmail(opts: { name?: string | null }): { html: string; text: string } {
  const first = opts.name?.split(" ")[0]?.trim()
  const heading = first ? `You&rsquo;re approved, ${first}.` : "Your organizer account is approved."
  const dashboardUrl = `${APP_URL}/organizer`
  const body = `
    <p style="margin:0 0 14px;">
      Great news &mdash; your TicketPulse organizer account has been reviewed and
      approved. You can now create and publish events, sell tickets, and manage
      your payouts.
    </p>
    <p style="margin:0;">
      Head to your dashboard to get started.
    </p>`

  const html = layout({
    preheader: "Your organizer account is approved — start creating events on TicketPulse.",
    heading,
    body,
    cta: { label: "Go to dashboard", href: dashboardUrl },
  })

  const text = [
    heading,
    "",
    "Great news — your TicketPulse organizer account has been reviewed and approved.",
    "You can now create and publish events, sell tickets, and manage your payouts.",
    "",
    `Dashboard: ${dashboardUrl}`,
  ].join("\n")

  return { html, text }
}

// ─── New-signup admin notification ───────────────────────────────────────────

export function newSignupAdminNotification(opts: {
  name: string | null
  email: string
  role: string
}): { html: string; text: string } {
  const { name, email, role } = opts
  const adminUrl = `${APP_URL}/admin/users`
  const heading = "New user signup"
  const body = `
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%"
           style="margin:0 0 14px;padding:18px;border:1px solid ${BRAND.line};border-radius:14px;background:${BRAND.paper2};">
      <tr>
        <td style="padding:6px 12px 6px 0;font-size:12px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;color:${BRAND.ink3};white-space:nowrap;vertical-align:top;">
          Name
        </td>
        <td style="padding:6px 0;font-size:14px;color:${BRAND.ink};vertical-align:top;">
          ${escape(name ?? "—")}
        </td>
      </tr>
      <tr>
        <td style="padding:6px 12px 6px 0;font-size:12px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;color:${BRAND.ink3};white-space:nowrap;vertical-align:top;">
          Email
        </td>
        <td style="padding:6px 0;font-size:14px;color:${BRAND.ink};vertical-align:top;">
          <a href="mailto:${escape(email)}" style="color:${BRAND.blue};text-decoration:underline;">${escape(email)}</a>
        </td>
      </tr>
      <tr>
        <td style="padding:6px 12px 6px 0;font-size:12px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;color:${BRAND.ink3};white-space:nowrap;vertical-align:top;">
          Role
        </td>
        <td style="padding:6px 0;font-size:14px;color:${BRAND.ink};vertical-align:top;text-transform:capitalize;">
          ${escape(role)}
        </td>
      </tr>
    </table>
    <p style="margin:0 0 14px;font-size:13px;color:${BRAND.ink3};">
      View all users in the admin panel.
    </p>`

  const html = layout({
    preheader: `New ${role} signup: ${email}`,
    heading,
    body,
    cta: { label: "View users", href: adminUrl },
  })

  const text = [
    heading,
    "",
    `Name: ${name ?? "—"}`,
    `Email: ${email}`,
    `Role: ${role}`,
    "",
    `View users: ${adminUrl}`,
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

// ─── Organiser invite ────────────────────────────────────────────────────

export function organiserInviteEmail(opts: {
  inviterName: string
  eventTitle: string
  inviteUrl: string
  email: string
  expiresInHours?: number
}): { html: string; text: string } {
  const { inviterName, eventTitle, inviteUrl, email, expiresInHours = 72 } = opts

  const heading = `You are invited to organise ${eventTitle}`
  const body = `
    <p style="margin:0 0 14px;">
      <strong style="color:${BRAND.ink};">${escape(inviterName)}</strong> has invited you to help organise
      <strong style="color:${BRAND.ink};">${escape(eventTitle)}</strong> on TicketPulse.
    </p>
    <p style="margin:0 0 14px;">
      As an invited organiser, you will be able to:
    </p>
    <ul style="margin:0 0 14px;padding-left:20px;font-size:14px;line-height:1.6;color:${BRAND.ink2};">
      <li>View event details and ticket sales</li>
      <li>Check in guests at the gate</li>
      <li>View the attendee list</li>
      <li>Generate staff tickets</li>
    </ul>
    <p style="margin:0 0 14px;font-size:13px;color:${BRAND.ink3};">
      This invitation was sent to <strong>${escape(email)}</strong>.
      It expires in ${expiresInHours} hours.
    </p>
    <p style="margin:0 0 14px;font-size:13px;color:${BRAND.ink3};">
      If you do not have a TicketPulse account yet, clicking the button below
      will let you create one and accept the invitation.
    </p>`

  const html = layout({
    preheader: `${inviterName} invited you to organise ${eventTitle} on TicketPulse.`,
    heading,
    body,
    cta: { label: "Accept invitation", href: inviteUrl },
  })

  const text = [
    heading,
    "",
    `${inviterName} has invited you to help organise ${eventTitle} on TicketPulse.`,
    "",
    "As an invited organiser, you will be able to:",
    "- View event details and ticket sales",
    "- Check in guests at the gate",
    "- View the attendee list",
    "- Generate staff tickets",
    "",
    `Accept invitation: ${inviteUrl}`,
    "",
    `This invitation was sent to ${email} and expires in ${expiresInHours} hours.`,
    "",
    "TicketPulse",
  ].join("\n")

  return { html, text }
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

// ─── Sale notification (organiser / admin) ────────────────────────────────────

export function saleNotificationEmail(opts: {
  role: "organizer" | "admin"
  eventTitle: string
  buyerName: string
  orderId: string
  items: { label: string; qty: number; amount: string }[]
  total: string
  currency: string
  organizerName?: string | null
}): { html: string; text: string } {
  const { role, eventTitle, buyerName, orderId, items, total, currency, organizerName } = opts
  const heading = role === "organizer"
    ? `🎟️ New ticket sale — ${eventTitle}`
    : `🎟️ Sale alert — ${eventTitle}`

  const subhead = role === "organizer"
    ? `Someone just bought tickets to <strong style="color:${BRAND.ink};">${escape(eventTitle)}</strong>.`
    : `A new order has been placed for <strong style="color:${BRAND.ink};">${escape(eventTitle)}</strong>.`

  const rows = items
    .map(
      (i) => `
      <tr>
        <td style="padding:6px 0;color:${BRAND.ink2};font-size:13px;">
          ${i.qty}&times; ${escape(i.label)}
        </td>
        <td style="padding:6px 0;text-align:right;color:${BRAND.ink};font-size:13px;font-variant-numeric:tabular-nums;">
          ${escape(i.amount)}
        </td>
      </tr>`,
    )
    .join("")

  const details = `
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%"
           style="margin:16px 0 8px;padding:18px;border:1px solid ${BRAND.line};border-radius:14px;background:${BRAND.paper2};">
      <tr>
        <td colspan="2" style="font-size:11px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:${BRAND.ink3};padding-bottom:8px;">
          Sale
        </td>
      </tr>
      <tr>
        <td style="padding:6px 12px 6px 0;font-size:12px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;color:${BRAND.ink3};white-space:nowrap;vertical-align:top;">
          Buyer
        </td>
        <td style="padding:6px 0;font-size:14px;color:${BRAND.ink};vertical-align:top;">
          ${escape(buyerName)}
        </td>
      </tr>
      ${rows}
      <tr>
        <td colspan="2"><hr style="border:none;border-top:1px solid ${BRAND.line};margin:10px 0;" /></td>
      </tr>
      <tr>
        <td style="font-size:14px;font-weight:700;color:${BRAND.ink};">Total</td>
        <td style="font-size:14px;font-weight:700;color:${BRAND.ink};text-align:right;font-variant-numeric:tabular-nums;">
          ${escape(total)} ${escape(currency)}
        </td>
      </tr>
      <tr>
        <td colspan="2" style="font-size:11px;color:${BRAND.ink3};padding-top:12px;letter-spacing:0.04em;">
          Order #${escape(orderId)}
        </td>
      </tr>
    </table>`

  const body = `
    <p style="margin:0 0 14px;">
      ${subhead}
    </p>
    ${details}
    ${role === "organizer"
      ? `<p style="margin:14px 0 0;font-size:13px;color:${BRAND.ink3};">
           You can track ticket sales from your organizer dashboard.
         </p>`
      : ""}`

  const html = layout({
    preheader: `New sale: ${buyerName} purchased tickets for ${eventTitle}.`,
    heading,
    body,
  })

  const textLines: string[] = [
    heading,
    "",
    subhead.replace(/<[^>]*>/g, ""),
    "",
    `Buyer: ${buyerName}`,
    ...items.map((i) => `${i.qty} x ${i.label}  :  ${i.amount}`),
    "",
    `Total: ${total} ${currency}`,
    `Order #${orderId}`,
    "",
    "TicketPulse",
  ]

  return { html, text: textLines.join("\n") }
}

// ─── Event published notification ─────────────────────────────────────────────

export function eventPublishedNotificationEmail(opts: {
  eventTitle: string
  eventDate: string
  eventUrl: string
  organizerName?: string | null
}): { html: string; text: string } {
  const { eventTitle, eventDate, eventUrl, organizerName } = opts

  const heading = `🎉 ${eventTitle} is now live`
  const first = organizerName?.split(" ")[0]?.trim()

  const body = `
    <p style="margin:0 0 14px;">
      ${first ? `Hey ${escape(first)},` : "Hi there,"}
      your event <strong style="color:${BRAND.ink};">${escape(eventTitle)}</strong>
      has been reviewed and published. It is now visible to everyone on TicketPulse.
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%"
           style="margin:16px 0 8px;padding:18px;border:1px solid ${BRAND.line};border-radius:14px;background:${BRAND.paper2};">
      <tr>
        <td style="padding:6px 12px 6px 0;font-size:12px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;color:${BRAND.ink3};white-space:nowrap;vertical-align:top;">
          Event
        </td>
        <td style="padding:6px 0;font-size:14px;color:${BRAND.ink};vertical-align:top;">
          ${escape(eventTitle)}
        </td>
      </tr>
      <tr>
        <td style="padding:6px 12px 6px 0;font-size:12px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;color:${BRAND.ink3};white-space:nowrap;vertical-align:top;">
          Date
        </td>
        <td style="padding:6px 0;font-size:14px;color:${BRAND.ink};vertical-align:top;">
          ${escape(eventDate)}
        </td>
      </tr>
    </table>
    <p style="margin:14px 0 0;font-size:13px;color:${BRAND.ink3};">
      Tickets are now on sale. Share the event link to start selling.
    </p>`

  const html = layout({
    preheader: `${eventTitle} is now live on TicketPulse.`,
    heading,
    body,
    cta: { label: "View event", href: eventUrl },
  })

  const text = [
    heading,
    "",
    `${first ? `Hey ${first},` : "Hi there,"} your event ${eventTitle} has been published and is now visible to everyone on TicketPulse.`,
    "",
    `Event: ${eventTitle}`,
    `Date: ${eventDate}`,
    "",
    `View event: ${eventUrl}`,
    "",
    "TicketPulse",
  ].join("\n")

  return { html, text }
}

// ─── Product announcement ──────────────────────────────────────────────────────

export function announcementEmail(opts: {
  name?: string | null
}): { html: string; text: string } {
  const first = opts.name?.split(" ")[0]?.trim()
  const greeting = first ? `Hey ${first},` : "Hi there,"
  const appUrl = APP_URL

  const body = `
    <p style="margin:0 0 14px;">
      ${escape(greeting)}
    </p>
    <p style="margin:0 0 14px;">
      We have been shipping. Here is what is new on TicketPulse.
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%"
           style="margin:16px 0 8px;padding:18px;border:1px solid ${BRAND.line};border-radius:14px;background:${BRAND.paper2};">
      <tr>
        <td style="padding:0 0 14px;">
          <table role="presentation" cellpadding="0" cellspacing="0">
            <tr>
              <td style="width:32px;vertical-align:top;padding:2px 10px 0 0;">
                <span style="font-size:16px;">📲</span>
              </td>
              <td style="font-size:14px;color:${BRAND.ink};">
                <strong style="display:block;font-size:14px;margin-bottom:2px;">Install as an app</strong>
                <span style="font-size:13px;color:${BRAND.ink2};">Add TicketPulse to your home screen for a native-like experience. Offline-ready, full-screen, no browser chrome.</span>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td style="padding:0 0 14px;">
          <table role="presentation" cellpadding="0" cellspacing="0">
            <tr>
              <td style="width:32px;vertical-align:top;padding:2px 10px 0 0;">
                <span style="font-size:16px;">🔑</span>
              </td>
              <td style="font-size:14px;color:${BRAND.ink};">
                <strong style="display:block;font-size:14px;margin-bottom:2px;">Sign in with Google</strong>
                <span style="font-size:13px;color:${BRAND.ink2};">One tap to sign in. No password needed.</span>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td style="padding:0 0 14px;">
          <table role="presentation" cellpadding="0" cellspacing="0">
            <tr>
              <td style="width:32px;vertical-align:top;padding:2px 10px 0 0;">
                <span style="font-size:16px;">👁️</span>
              </td>
              <td style="font-size:14px;color:${BRAND.ink};;">
                <strong style="display:block;font-size:14px;margin-bottom:2px;">Show / hide password</strong>
                <span style="font-size:13px;color:${BRAND.ink2};">See what you type on mobile sign-in. Fewer typos, less frustration.</span>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td style="padding:0 0 14px;">
          <table role="presentation" cellpadding="0" cellspacing="0">
            <tr>
              <td style="width:32px;vertical-align:top;padding:2px 10px 0 0;">
                <span style="font-size:16px;">🎟️</span>
              </td>
              <td style="font-size:14px;color:${BRAND.ink};">
                <strong style="display:block;font-size:14px;margin-bottom:2px;">PDF tickets & QR codes</strong>
                <span style="font-size:13px;color:${BRAND.ink2};">Download and print your tickets with real QR codes. One-click PDF download for all tickets in your order.</span>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td style="padding:0;">
          <table role="presentation" cellpadding="0" cellspacing="0">
            <tr>
              <td style="width:32px;vertical-align:top;padding:2px 10px 0 0;">
                <span style="font-size:16px;">📱</span>
              </td>
              <td style="font-size:14px;color:${BRAND.ink};">
                <strong style="display:block;font-size:14px;margin-bottom:2px;">Better on mobile</strong>
                <span style="font-size:13px;color:${BRAND.ink2};">Bigger text, clearer forms, faster checkout — everything just works better on your phone.</span>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
    <p style="margin:16px 0 0;font-size:13px;color:${BRAND.ink3};">
      Tap the button below to browse events and see for yourself.
    </p>`

  const html = layout({
    preheader: "Install as an app, sign in with Google, PDF tickets, and more.",
    heading: "New on TicketPulse",
    body,
    cta: { label: "Browse events", href: `${appUrl}/events` },
  })

  const text = [
    "New on TicketPulse",
    "",
    `${greeting}`,
    "",
    "We've been shipping. Here's what's new:",
    "",
    "📲 Install as an app — Add TicketPulse to your home screen for a native-like experience.",
    "🔑 Sign in with Google — One tap to sign in. No password needed.",
    "👁️ Show / hide password — See what you type on mobile sign-in.",
    "🎟️ PDF tickets & QR codes — Download and print your tickets with real QR codes.",
    "📱 Better on mobile — Bigger text, clearer forms, faster checkout.",
    "",
    `Browse events: ${appUrl}/events`,
    "",
    "TicketPulse",
  ].join("\n")

  return { html, text }
}

/**
 * Template for event organisers to send custom email messages to their
 * attendees. Supports {name} and {event} placeholders in the body.
 */
export function eventEmailTemplate(opts: {
  recipientName?: string | null
  eventTitle: string
  subject: string
  message: string
}): { html: string; text: string } {
  const first = opts.recipientName?.split(" ")[0]?.trim()
  const greeting = first ? `Hi ${escape(first)},` : "Hi there,"
  const bodyHtml = opts.message
    .replace(/\n/g, "<br>")
    .replace(/\{name\}/g, escape(first ?? "there"))
    .replace(/\{event\}/g, escape(opts.eventTitle))

  const body = `
    <p style="margin:0 0 14px;">
      ${escape(greeting)}
    </p>
    <div style="margin:0 0 14px;font-size:14px;line-height:1.7;color:${BRAND.ink2};">
      ${bodyHtml}
    </div>
    <hr style="border:0;border-top:1px solid ${BRAND.line};margin:24px 0 16px;">
    <p style="margin:0 0 0;font-size:13px;color:${BRAND.ink3};">
      You are receiving this email because you purchased tickets for
      <strong style="color:${BRAND.ink};">${escape(opts.eventTitle)}</strong>
      on <a href="${APP_URL}" style="color:${BRAND.blue};text-decoration:underline;">TicketPulse</a>.
    </p>`

  const html = layout({
    preheader: opts.subject,
    heading: escape(opts.subject),
    body,
  })

  const text = [
    opts.subject,
    "",
    greeting,
    "",
    opts.message.replace(/\{name\}/g, first ?? "there").replace(/\{event\}/g, opts.eventTitle),
    "",
    `---`,
    `You are receiving this email because you purchased tickets for ${opts.eventTitle} on TicketPulse.`,
    APP_URL,
  ].join("\n")

  return { html, text }
}

// ─── New event announcement to past attendees ─────────────────────────────────

export function newEventAnnouncementTemplate(opts: {
  recipientName?: string | null
  newEventTitle: string
  newEventUrl: string
  subject: string
  message: string
  organizerName: string
}): { html: string; text: string } {
  const first = opts.recipientName?.split(" ")[0]?.trim()
  const greeting = first ? `Hi ${escape(first)},` : "Hi there,"
  const bodyHtml = opts.message
    .replace(/\n/g, "<br>")
    .replace(/\{name\}/g, escape(first ?? "there"))
    .replace(/\{event\}/g, escape(opts.newEventTitle))

  const body = `
    <p style="margin:0 0 14px;">
      ${escape(greeting)}
    </p>
    <div style="margin:0 0 20px;font-size:14px;line-height:1.7;color:${BRAND.ink2};">
      ${bodyHtml}
    </div>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
      <tr>
        <td>
          <a href="${opts.newEventUrl}"
            style="display:inline-block;background:${BRAND.navy};color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;padding:12px 24px;border-radius:10px;">
            View ${escape(opts.newEventTitle)} →
          </a>
        </td>
      </tr>
    </table>
    <hr style="border:0;border-top:1px solid ${BRAND.line};margin:24px 0 16px;">
    <p style="margin:0;font-size:12px;color:${BRAND.ink3};">
      You are receiving this because you previously purchased tickets through
      <strong style="color:${BRAND.ink};">${escape(opts.organizerName)}</strong> on
      <a href="${APP_URL}" style="color:${BRAND.blue};text-decoration:underline;">TicketPulse</a>.
      This is not a transactional email — if you do not wish to receive announcements, reply and let us know.
    </p>`

  const html = layout({
    preheader: opts.subject,
    heading: escape(opts.newEventTitle),
    body,
  })

  const text = [
    opts.subject,
    "",
    greeting,
    "",
    opts.message.replace(/\{name\}/g, first ?? "there").replace(/\{event\}/g, opts.newEventTitle),
    "",
    `View event: ${opts.newEventUrl}`,
    "",
    `---`,
    `You are receiving this because you previously purchased tickets through ${opts.organizerName} on TicketPulse (${APP_URL}).`,
  ].join("\n")

  return { html, text }
}

// ─── GROQ AI announcement ──────────────────────────────────────────────────────

export function groqAiAnnouncementEmail(opts: {
  name?: string | null
}): { html: string; text: string } {
  const first = opts.name?.split(" ")[0]?.trim()
  const greeting = first ? `Hey ${first},` : "Hi there,"
  const appUrl = APP_URL

  const body = `
    <p style="margin:0 0 14px;">
      ${escape(greeting)}
    </p>
    <p style="margin:0 0 14px;">
      We have just shipped a major upgrade — <strong style="color:${BRAND.ink};">AI-powered tools</strong>
      across the TicketPulse platform powered by GROQ&rsquo;s Llama 3.3-70B model.
      Here is what is now available.
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%"
           style="margin:16px 0 8px;padding:18px;border:1px solid ${BRAND.line};border-radius:14px;background:${BRAND.paper2};">

      <tr>
        <td style="padding:0 0 14px;">
          <table role="presentation" cellpadding="0" cellspacing="0">
            <tr>
              <td style="width:32px;vertical-align:top;padding:2px 10px 0 0;">
                <span style="font-size:16px;">✍️</span>
              </td>
              <td style="font-size:14px;color:${BRAND.ink};">
                <strong style="display:block;font-size:14px;margin-bottom:2px;">AI Event Description</strong>
                <span style="font-size:13px;color:${BRAND.ink2};">Generate compelling event descriptions instantly. Just pick a title, category, and venue — AI writes the rest.</span>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <tr>
        <td style="padding:0 0 14px;">
          <table role="presentation" cellpadding="0" cellspacing="0">
            <tr>
              <td style="width:32px;vertical-align:top;padding:2px 10px 0 0;">
                <span style="font-size:16px;">📍</span>
              </td>
              <td style="font-size:14px;color:${BRAND.ink};">
                <strong style="display:block;font-size:14px;margin-bottom:2px;">AI Location Suggestions</strong>
                <span style="font-size:13px;color:${BRAND.ink2};">Enter a venue name and city — AI fills in the country and address automatically.</span>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <tr>
        <td style="padding:0 0 14px;">
          <table role="presentation" cellpadding="0" cellspacing="0">
            <tr>
              <td style="width:32px;vertical-align:top;padding:2px 10px 0 0;">
                <span style="font-size:16px;">🏷️</span>
              </td>
              <td style="font-size:14px;color:${BRAND.ink};">
                <strong style="display:block;font-size:14px;margin-bottom:2px;">AI Tag Suggestions</strong>
                <span style="font-size:13px;color:${BRAND.ink2};">Smart tag recommendations based on your event title and description. Click to add.</span>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <tr>
        <td style="padding:0 0 14px;">
          <table role="presentation" cellpadding="0" cellspacing="0">
            <tr>
              <td style="width:32px;vertical-align:top;padding:2px 10px 0 0;">
                <span style="font-size:16px;">💰</span>
              </td>
              <td style="font-size:14px;color:${BRAND.ink};">
                <strong style="display:block;font-size:14px;margin-bottom:2px;">AI Pricing Suggestions</strong>
                <span style="font-size:13px;color:${BRAND.ink2};">Get a suggested price range with reasoning based on your event type, category, and location.</span>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <tr>
        <td style="padding:0 0 14px;">
          <table role="presentation" cellpadding="0" cellspacing="0">
            <tr>
              <td style="width:32px;vertical-align:top;padding:2px 10px 0 0;">
                <span style="font-size:16px;">📱</span>
              </td>
              <td style="font-size:14px;color:${BRAND.ink};">
                <strong style="display:block;font-size:14px;margin-bottom:2px;">AI Social Post Generator</strong>
                <span style="font-size:13px;color:${BRAND.ink2};">Generate Twitter/X, Facebook, or Instagram posts for your event. Copy and post in one click.</span>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <tr>
        <td style="padding:0 0 14px;">
          <table role="presentation" cellpadding="0" cellspacing="0">
            <tr>
              <td style="width:32px;vertical-align:top;padding:2px 10px 0 0;">
                <span style="font-size:16px;">📧</span>
              </td>
              <td style="font-size:14px;color:${BRAND.ink};">
                <strong style="display:block;font-size:14px;margin-bottom:2px;">AI Email Copilot</strong>
                <span style="font-size:13px;color:${BRAND.ink2};">Draft professional attendee emails with AI. Choose a purpose or write custom instructions — AI generates subject and body.</span>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <tr>
        <td style="padding:0 0 14px;">
          <table role="presentation" cellpadding="0" cellspacing="0">
            <tr>
              <td style="width:32px;vertical-align:top;padding:2px 10px 0 0;">
                <span style="font-size:16px;">📊</span>
              </td>
              <td style="font-size:14px;color:${BRAND.ink};">
                <strong style="display:block;font-size:14px;margin-bottom:2px;">AI Sales Insights</strong>
                <span style="font-size:13px;color:${BRAND.ink2};">Get actionable sales tips for each event on your organizer dashboard. One click, instant insight.</span>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <tr>
        <td style="padding:0;">
          <table role="presentation" cellpadding="0" cellspacing="0">
            <tr>
              <td style="width:32px;vertical-align:top;padding:2px 10px 0 0;">
                <span style="font-size:16px;">🛡️</span>
              </td>
              <td style="font-size:14px;color:${BRAND.ink};">
                <strong style="display:block;font-size:14px;margin-bottom:2px;">AI Content Moderation (Admin)</strong>
                <span style="font-size:13px;color:${BRAND.ink2};">Admins can now check draft event content for guidelines compliance before approving.</span>
              </td>
            </tr>
          </table>
        </td>
      </tr>

    </table>
    <p style="margin:16px 0 0;font-size:13px;color:${BRAND.ink3};">
      All AI features are powered by GROQ&rsquo;s Llama 3.3-70B — fast, free, and running at blazing speed.
    </p>
    <p style="margin:6px 0 0;font-size:13px;color:${BRAND.ink3};">
      Head to your dashboard to try them out.
    </p>`

  const html = layout({
    preheader: "New AI-powered tools: descriptions, pricing, social posts, email copilot, and more.",
    heading: "🚀 AI is here on TicketPulse",
    body,
    cta: { label: "Go to dashboard", href: `${appUrl}/dashboard` },
  })

  const text = [
    "🚀 AI is here on TicketPulse",
    "",
    `${greeting}`,
    "",
    "We've just shipped AI-powered tools across the platform, powered by GROQ's Llama 3.3-70B:",
    "",
    "✍️ AI Event Description — Generate event descriptions instantly.",
    "📍 AI Location Suggestions — Auto-fill country and address from venue name.",
    "🏷️ AI Tag Suggestions — Smart tags based on your event.",
    "💰 AI Pricing Suggestions — Get suggested price ranges with reasoning.",
    "📱 AI Social Post Generator — Create Twitter/X, Facebook, or Instagram posts.",
    "📧 AI Email Copilot — Draft professional attendee emails with AI.",
    "📊 AI Sales Insights — Actionable tips on your organizer dashboard.",
    "🛡️ AI Content Moderation — For admins reviewing draft events.",
    "",
    "Head to your dashboard to try them out:",
    `${appUrl}/dashboard`,
    "",
    "TicketPulse",
  ].join("\n")

  return { html, text }
}

// ─── New features announcement: Hide organizer + FAQ ─────────────────────────

export function newFeaturesAnnouncementEmail(opts: {
  name?: string | null
}): { html: string; text: string } {
  const first = opts.name?.split(" ")[0]?.trim()
  const greeting = first ? `Hey ${first},` : "Hi there,"
  const appUrl = APP_URL

  const body = `
    <p style="margin:0 0 14px;">
      ${escape(greeting)}
    </p>
    <p style="margin:0 0 14px;">
      We have just shipped two new features to help you run better events on TicketPulse.
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%"
           style="margin:16px 0 8px;padding:18px;border:1px solid ${BRAND.line};border-radius:14px;background:${BRAND.paper2};">
      <tr>
        <td style="padding:0 0 14px;">
          <table role="presentation" cellpadding="0" cellspacing="0">
            <tr>
              <td style="width:32px;vertical-align:top;padding:2px 10px 0 0;">
                <span style="font-size:16px;">🙈</span>
              </td>
              <td style="font-size:14px;color:${BRAND.ink};">
                <strong style="display:block;font-size:14px;margin-bottom:2px;">Hide Your Name from the Event Page</strong>
                <span style="font-size:13px;color:${BRAND.ink2};">You can now choose to hide &quot;Organized by [your name]&quot; from the public event page. Toggle it on when creating or editing any event — perfect for private events, surprise parties, or when you simply prefer to keep a low profile.</span>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td style="padding:0;">
          <table role="presentation" cellpadding="0" cellspacing="0">
            <tr>
              <td style="width:32px;vertical-align:top;padding:2px 10px 0 0;">
                <span style="font-size:16px;">❓</span>
              </td>
              <td style="font-size:14px;color:${BRAND.ink};">
                <strong style="display:block;font-size:14px;margin-bottom:2px;">More About This Event — FAQ Section</strong>
                <span style="font-size:13px;color:${BRAND.ink2};">Add a dedicated &quot;More About This Event&quot; section to any event page. Use it for FAQs, what to bring, dress code, parking info, refund policies, accessibility details — anything your attendees need to know. This appears right on the public event page below the description.</span>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
    <p style="margin:16px 0 0;font-size:13px;color:${BRAND.ink3};">
      Both options are available now when you create or edit an event.
    </p>`

  const html = layout({
    preheader: "Hide your name from events and add FAQ sections — new on TicketPulse.",
    heading: "New on TicketPulse",
    body,
    cta: { label: "Go to organizer dashboard", href: `${appUrl}/organizer` },
  })

  const text = [
    "New on TicketPulse",
    "",
    greeting,
    "",
    "We've just shipped two new features to help you run better events:",
    "",
    "🙈 Hide Your Name from the Event Page",
    "Choose to hide 'Organized by [your name]' from the public event page. Perfect for private events or when you prefer to keep a low profile. Toggle it when creating or editing any event.",
    "",
    "❓ More About This Event — FAQ Section",
    "Add a dedicated 'More About This Event' section to any event page. Use it for FAQs, what to bring, dress code, parking info, refund policies, accessibility details — anything attendees need to know.",
    "",
    "Both options are available now when you create or edit an event.",
    "",
    `Go to your dashboard: ${appUrl}/organizer`,
    "",
    "TicketPulse",
  ].join("\n")

  return { html, text }
}

// ─── Velocity reconciliation report ─────────────────────────────────────────

export function velocityReconciliationEmail(opts: {
  generatedAt: Date
  totals: {
    velocityReceived: number
    velocityPaidToTicketPulse: number
    velocityUnsettled: number
    localPaidRevenue: number
    variance: number
    paidOrders: number
    criticalIssues: number
    warningIssues: number
  }
  note?: string | null
}): { html: string; text: string } {
  const stamp = opts.generatedAt.toISOString().slice(0, 10)
  const heading = `Velocity reconciliation — ${stamp}`
  const rows: [string, string][] = [
    ["Velocity received", formatMoney(opts.totals.velocityReceived, "USD")],
    ["Paid by Velocity to TicketPulse", formatMoney(opts.totals.velocityPaidToTicketPulse, "USD")],
    ["Not yet matched", formatMoney(opts.totals.velocityUnsettled, "USD")],
    ["Local paid revenue", formatMoney(opts.totals.localPaidRevenue, "USD")],
    ["Variance", formatMoney(opts.totals.variance, "USD")],
    ["Paid orders", String(opts.totals.paidOrders)],
    ["Critical issues", String(opts.totals.criticalIssues)],
    ["Warnings", String(opts.totals.warningIssues)],
  ]

  const tableRows = rows
    .map(
      ([label, value]) => `
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid ${BRAND.line};font-size:13px;color:${BRAND.ink2};">${escape(label)}</td>
          <td style="padding:8px 12px;border-bottom:1px solid ${BRAND.line};font-size:13px;font-weight:600;color:${BRAND.ink};text-align:right;">${escape(value)}</td>
        </tr>`,
    )
    .join("")

  const noteBlock = opts.note
    ? `<p style="margin:14px 0 0;font-size:14px;line-height:22px;">${escape(opts.note)}</p>`
    : ""

  const body = `
    <p style="margin:0 0 14px;">
      Please find attached the TicketPulse &harr; Velocity payment reconciliation
      report for review, in PDF and CSV format. A summary of the period to date
      is below.
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border:1px solid ${BRAND.line};border-radius:12px;border-collapse:separate;overflow:hidden;">
      ${tableRows}
    </table>
    ${noteBlock}
    <p style="margin:14px 0 0;font-size:13px;color:${BRAND.ink3};">
      Generated ${escape(opts.generatedAt.toISOString().replace("T", " ").slice(0, 16))} UTC.
      Reply to this email if any figures need clarification.
    </p>`

  const html = layout({
    preheader: `Velocity reconciliation report ${stamp} — PDF and CSV attached.`,
    heading,
    body,
  })

  const text = [
    heading,
    "",
    "TicketPulse <-> Velocity payment reconciliation report attached (PDF and CSV).",
    "",
    ...rows.map(([label, value]) => `${label}: ${value}`),
    ...(opts.note ? ["", `Note: ${opts.note}`] : []),
    "",
    `Generated ${opts.generatedAt.toISOString()}`,
    "TicketPulse",
  ].join("\n")

  return { html, text }
}
