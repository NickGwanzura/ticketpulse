import { APP_URL, BRAND, escape, formatMoney, layout, type LayoutOpts } from "./shared"

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
