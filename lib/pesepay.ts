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
}

/**
 * Shape of the `metadata.pesepay` object stored on orders.
 */
export interface PesepayOrderMetadata {
  pollUrl?: string
  reference?: string
}

/**
 * Shape of the top-level `metadata` JSON column for orders involving PesaPay.
 */
export interface OrderMetadata {
  pesepay?: PesepayOrderMetadata
  promo?: {
    code: string
    type: string
    value: string
    discount: number
  }
}

export function getPesepay(): Pesepay {
  const integrationKey = process.env.PESEPAY_INTEGRATION_KEY
  const encryptionKey = process.env.PESEPAY_ENCRYPTION_KEY
  if (!integrationKey || !encryptionKey) {
    throw new Error("PESEPAY_INTEGRATION_KEY / PESEPAY_ENCRYPTION_KEY not set")
  }
  return new Pesepay(integrationKey, encryptionKey)
}

/**
 * Optional webhook secret for verifying that incoming PesaPay webhook POSTs
 * are genuinely from PesaPay. Set `PESEPAY_WEBHOOK_SECRET` in your environment;
 * if unset, webhook verification is skipped (legacy behaviour).
 *
 * PesaPay sends the secret in the `X-PesePay-Signature` header. We compare
 * against the configured value using a timing-safe comparison.
 */
export function verifyWebhookSecret(requestSignature: string | null): boolean {
  const secret = process.env.PESEPAY_WEBHOOK_SECRET
  if (!secret) {
    // No secret configured — accept the webhook (backwards-compatible).
    return true
  }
  if (!requestSignature) {
    return false
  }
  // Constant-time comparison to prevent timing attacks.
  if (requestSignature.length !== secret.length) {
    return false
  }
  let mismatch = 0
  for (let i = 0; i < requestSignature.length; i++) {
    mismatch |= requestSignature.charCodeAt(i) ^ secret.charCodeAt(i)
  }
  return mismatch === 0
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
