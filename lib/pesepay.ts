import "server-only"
// The pesepay package's "types" field points at the dist directory without an
// index.d.ts, so resolution via the bare specifier fails. Import the subpath
// where the type declarations actually live.
import { Pesepay } from "pesepay/dist/pesepay"

// Maps the buyer-facing payment values in the checkout UI to PesePay's
// payment-method codes. Seamless methods stay on our checkout page and prompt
// the buyer on their phone; redirect methods bounce through PesePay's hosted
// page (used for cards so we don't pull PCI scope into this app).
export type PesepayFlow = "seamless" | "redirect" | "offline"

export interface PesepayMethod {
  code: string | null
  flow: PesepayFlow
  // Field name PesePay expects in `requiredFields` for seamless methods.
  phoneField?: string
}

export const PESEPAY_METHODS: Record<string, PesepayMethod> = {
  // Mobile money — true server-to-server, customer confirms on phone.
  ecocash: { code: "PZW211", flow: "seamless", phoneField: "customerPhoneNumber" },
  omari:   { code: "PZW216", flow: "seamless", phoneField: "customerPhoneNumber" },
  // Card — redirect to PesePay's hosted page (avoids PCI scope here).
  card:    { code: null, flow: "redirect" },
  // Paynow is not a PesePay method; treat as redirect for now (PesePay's
  // hosted page lets the buyer pick any supported instrument).
  paynow:  { code: null, flow: "redirect" },
  // Pay-at-venue — never touches PesePay.
  usd:     { code: null, flow: "offline" },
}

export function getPesepay(): Pesepay {
  const integrationKey = process.env.PESEPAY_INTEGRATION_KEY
  const encryptionKey = process.env.PESEPAY_ENCRYPTION_KEY
  if (!integrationKey || !encryptionKey) {
    throw new Error("PESEPAY_INTEGRATION_KEY / PESEPAY_ENCRYPTION_KEY not set")
  }
  return new Pesepay(integrationKey, encryptionKey)
}

// resultUrl is the webhook PesePay POSTs to; returnUrl is where the buyer is
// sent in the browser after the hosted-checkout step. We derive both from
// PESEPAY_PUBLIC_URL when set (needed for webhooks to reach localhost via a
// tunnel), otherwise from the inbound request origin.
export function pesepayUrls(orderId: string, requestOrigin: string) {
  const base = (process.env.PESEPAY_PUBLIC_URL || requestOrigin).replace(/\/$/, "")
  return {
    resultUrl: `${base}/api/checkout/pesepay/webhook`,
    returnUrl: `${base}/api/checkout/pesepay/return/${orderId}`,
  }
}
