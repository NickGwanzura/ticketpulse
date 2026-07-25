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

export const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? "https://ticketpulse.tech"

export const BRAND = {
  ink: "#0B1220",
  ink2: "#384151",
  ink3: "#6B7280",
  paper: "#FFFFFF",
  paper2: "#F6F9FC",
  line: "#E6ECF2",
  blue: "#2D6CDF",
  navy: "#0B1F4A",
} as const

export function escape(s: string): string {
  return s.replace(/[<>&"']/g, (c) =>
    ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&#39;" }[c]!),
  )
}

export function formatMoney(amount: number, currency: string): string {
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

export type LayoutOpts = {
  preheader?: string
  heading: string
  body: string
  cta?: { label: string; href: string }
}

export function layout({ preheader, heading, body, cta }: LayoutOpts): string {
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

