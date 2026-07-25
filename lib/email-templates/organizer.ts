import { APP_URL, BRAND, escape, formatMoney, layout, type LayoutOpts } from "./shared"

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

// ─── Event submitted for review (admin notification) ────────────────────────

export function eventSubmittedForReviewAdminEmail(opts: {
  eventTitle: string
  organizerName?: string | null
}): { html: string; text: string } {
  const { eventTitle, organizerName } = opts
  const adminUrl = `${APP_URL}/admin/events?status=pending_review`
  const heading = "Event pending review"

  const body = `
    <p style="margin:0 0 14px;">
      <strong style="color:${BRAND.ink};">${escape(organizerName ?? "An organizer")}</strong>
      submitted <strong style="color:${BRAND.ink};">${escape(eventTitle)}</strong> for review.
      It will not be visible to attendees until it is approved.
    </p>`

  const html = layout({
    preheader: `${eventTitle} is waiting for approval.`,
    heading,
    body,
    cta: { label: "Review event", href: adminUrl },
  })

  const text = [
    heading,
    "",
    `${organizerName ?? "An organizer"} submitted ${eventTitle} for review.`,
    "It will not be visible to attendees until it is approved.",
    "",
    `Review: ${adminUrl}`,
  ].join("\n")

  return { html, text }
}

// ─── Event submitted for review (organizer confirmation) ────────────────────

export function eventSubmittedForReviewOrganizerEmail(opts: {
  eventTitle: string
  organizerName?: string | null
}): { html: string; text: string } {
  const { eventTitle, organizerName } = opts
  const first = organizerName?.split(" ")[0]?.trim()
  const heading = "Your event is under review"
  const dashboardUrl = `${APP_URL}/organizer`

  const body = `
    <p style="margin:0 0 14px;">
      ${first ? `Hey ${escape(first)},` : "Hi there,"}
      we've received <strong style="color:${BRAND.ink};">${escape(eventTitle)}</strong>
      and it's now with the TicketPulse team for review.
    </p>
    <p style="margin:0;">
      We'll email you as soon as it's approved and live, usually within one business day.
    </p>`

  const html = layout({
    preheader: `${eventTitle} was submitted and is awaiting approval.`,
    heading,
    body,
    cta: { label: "Go to dashboard", href: dashboardUrl },
  })

  const text = [
    heading,
    "",
    `${first ? `Hey ${first},` : "Hi there,"} we've received ${eventTitle} and it's now with the TicketPulse team for review.`,
    "We'll email you as soon as it's approved and live, usually within one business day.",
    "",
    `Dashboard: ${dashboardUrl}`,
  ].join("\n")

  return { html, text }
}

// ─── Event rejected (organizer notification) ─────────────────────────────────

export function eventRejectedEmail(opts: {
  eventTitle: string
  organizerName?: string | null
  reason?: string | null
}): { html: string; text: string } {
  const { eventTitle, organizerName, reason } = opts
  const first = organizerName?.split(" ")[0]?.trim()
  const heading = "Your event needs changes"
  const editUrl = `${APP_URL}/organizer`

  const body = `
    <p style="margin:0 0 14px;">
      ${first ? `Hey ${escape(first)},` : "Hi there,"}
      your event <strong style="color:${BRAND.ink};">${escape(eventTitle)}</strong>
      was reviewed and sent back to draft${reason ? " with the following note" : ""}.
    </p>
    ${reason ? `
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%"
           style="margin:0 0 14px;padding:18px;border:1px solid ${BRAND.line};border-radius:14px;background:${BRAND.paper2};">
      <tr>
        <td style="font-size:14px;color:${BRAND.ink};">${escape(reason)}</td>
      </tr>
    </table>` : ""}
    <p style="margin:0;">
      Make the requested changes and resubmit it for review whenever you're ready.
    </p>`

  const html = layout({
    preheader: `${eventTitle} was sent back to draft.`,
    heading,
    body,
    cta: { label: "Go to dashboard", href: editUrl },
  })

  const text = [
    heading,
    "",
    `${first ? `Hey ${first},` : "Hi there,"} your event ${eventTitle} was reviewed and sent back to draft.`,
    reason ? `Note: ${reason}` : "",
    "",
    "Make the requested changes and resubmit it for review whenever you're ready.",
    "",
    `Dashboard: ${editUrl}`,
  ].filter(Boolean).join("\n")

  return { html, text }
}

// ─── Product announcement ──────────────────────────────────────────────────────

