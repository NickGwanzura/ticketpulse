import { APP_URL, BRAND, escape, formatMoney, layout } from "./shared"
import { generateOrderAccessUrl } from "@/lib/tickets"

export function reviewRequestEmail(opts: {
  name?: string | null
  eventTitle: string
  reviewUrl: string
}): { html: string; text: string } {
  const first = opts.name?.split(" ")[0]?.trim() || "there"
  const heading = "How was your TicketPulse experience?"
  const body = `
    <p style="margin:0 0 14px;">Hi ${escape(first)},</p>
    <p style="margin:0 0 14px;">Thank you for booking <strong>${escape(opts.eventTitle)}</strong> through TicketPulse.</p>
    <p style="margin:0;">How was the TicketPulse service — checkout, EcoCash or card payment, ticket delivery, and support? Please take a minute to share your experience.</p>`
  const html = layout({
    preheader: `Tell us how ${opts.eventTitle} went.`,
    heading,
    body,
    cta: { label: "Leave a review", href: opts.reviewUrl },
  })
  const text = [
    heading,
    "",
    `Hi ${first},`,
    "",
    `Thank you for booking ${opts.eventTitle} through TicketPulse.`,
    "",
    "How was the TicketPulse service — checkout, EcoCash or card payment, ticket delivery, and support? Please take a minute to share your experience.",
    "",
    `Leave a review: ${opts.reviewUrl}`,
    "",
    "TicketPulse",
  ].join("\n")
  return { html, text }
}

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

// ─── Organizer rejected ────────────────────────────────────────────────────

export function organizerRejectedEmail(opts: { name?: string | null }): { html: string; text: string } {
  const first = opts.name?.split(" ")[0]?.trim()
  const heading = first ? `About your application, ${first}` : "About your organizer application"
  const supportUrl = `${APP_URL}/contact`
  const body = `
    <p style="margin:0 0 14px;">
      We&rsquo;ve reviewed your TicketPulse organizer application and are
      unable to approve it at this time.
    </p>
    <p style="margin:0;">
      If you think this is a mistake or want more details, reach out and we&rsquo;ll follow up.
    </p>`

  const html = layout({
    preheader: "An update on your TicketPulse organizer application.",
    heading,
    body,
    cta: { label: "Contact support", href: supportUrl },
  })

  const text = [
    heading,
    "",
    "We've reviewed your TicketPulse organizer application and are unable to approve it at this time.",
    "If you think this is a mistake or want more details, reach out and we'll follow up.",
    "",
    `Support: ${supportUrl}`,
  ].join("\n")

  return { html, text }
}

// ─── Vendor approved ───────────────────────────────────────────────────────

export function vendorApprovedEmail(opts: { businessName?: string | null }): { html: string; text: string } {
  const heading = opts.businessName ? `${opts.businessName} is verified.` : "Your vendor listing is verified."
  const dashboardUrl = `${APP_URL}/vendors/dashboard`
  const body = `
    <p style="margin:0 0 14px;">
      Your TicketPulse vendor application has been reviewed and approved.
      Your listing is now live and organizers can book you for events.
    </p>
    <p style="margin:0;">
      Head to your dashboard to manage your listing and bookings.
    </p>`

  const html = layout({
    preheader: "Your vendor listing is verified and live on TicketPulse.",
    heading,
    body,
    cta: { label: "Go to dashboard", href: dashboardUrl },
  })

  const text = [
    heading,
    "",
    "Your TicketPulse vendor application has been reviewed and approved.",
    "Your listing is now live and organizers can book you for events.",
    "",
    `Dashboard: ${dashboardUrl}`,
  ].join("\n")

  return { html, text }
}

// ─── Vendor declined / revoked ──────────────────────────────────────────────

export function vendorDeclinedEmail(opts: { businessName?: string | null; wasVerified: boolean }): { html: string; text: string } {
  const heading = opts.wasVerified ? "Your vendor verification was revoked" : "About your vendor application"
  const supportUrl = `${APP_URL}/contact`
  const explanation = opts.wasVerified
    ? "Your TicketPulse vendor listing has been unverified and is no longer visible in the public marketplace."
    : "We've reviewed your TicketPulse vendor application and are unable to approve it at this time."
  const body = `
    <p style="margin:0 0 14px;">${explanation}</p>
    <p style="margin:0;">
      If you think this is a mistake or want more details, reach out and we&rsquo;ll follow up.
    </p>`

  const html = layout({
    preheader: explanation,
    heading,
    body,
    cta: { label: "Contact support", href: supportUrl },
  })

  const text = [heading, "", explanation, "", `Support: ${supportUrl}`].join("\n")

  return { html, text }
}

// ─── Transport operator approved ───────────────────────────────────────────

export function transportOperatorApprovedEmail(opts: { companyName?: string | null }): { html: string; text: string } {
  const heading = opts.companyName ? `${opts.companyName} is verified.` : "Your transport operator account is verified."
  const dashboardUrl = `${APP_URL}/transport/dashboard`
  const body = `
    <p style="margin:0 0 14px;">
      Your TicketPulse transport operator application has been reviewed and
      approved. You can now publish routes and sell shuttle seats.
    </p>
    <p style="margin:0;">
      Head to your dashboard to get started.
    </p>`

  const html = layout({
    preheader: "Your transport operator account is verified — start publishing routes on TicketPulse.",
    heading,
    body,
    cta: { label: "Go to dashboard", href: dashboardUrl },
  })

  const text = [
    heading,
    "",
    "Your TicketPulse transport operator application has been reviewed and approved.",
    "You can now publish routes and sell shuttle seats.",
    "",
    `Dashboard: ${dashboardUrl}`,
  ].join("\n")

  return { html, text }
}

// ─── Transport operator declined / revoked ─────────────────────────────────

export function transportOperatorDeclinedEmail(opts: { companyName?: string | null; wasVerified: boolean }): { html: string; text: string } {
  const heading = opts.wasVerified ? "Your transport operator verification was revoked" : "About your transport operator application"
  const supportUrl = `${APP_URL}/contact`
  const explanation = opts.wasVerified
    ? "Your TicketPulse transport operator account has been unverified and can no longer publish routes."
    : "We've reviewed your TicketPulse transport operator application and are unable to approve it at this time."
  const body = `
    <p style="margin:0 0 14px;">${explanation}</p>
    <p style="margin:0;">
      If you think this is a mistake or want more details, reach out and we&rsquo;ll follow up.
    </p>`

  const html = layout({
    preheader: explanation,
    heading,
    body,
    cta: { label: "Contact support", href: supportUrl },
  })

  const text = [heading, "", explanation, "", `Support: ${supportUrl}`].join("\n")

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
  const orderUrl = generateOrderAccessUrl(orderId, APP_URL)

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
