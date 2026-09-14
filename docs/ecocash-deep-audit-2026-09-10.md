# EcoCash / Velocity integration audit — 10 September 2026

## Executive finding

EcoCash is reaching Velocity. The dominant customer complaint is a confirmation and recovery problem, with a smaller but serious retry/idempotency problem. In the live 14-day cohort there are 51 EcoCash orders: 8 pending, 12 paid, 20 completed, and 11 expired. The same query returned 14 card orders: 8 paid, 1 completed, and 5 expired. These are order-state counts, not a payment success-rate denominator. The production database and read-only Velocity lookups show three EcoCash orders that are locally expired while Velocity reports `PAID`, `paidAmount = 40`, and `outstandingAmount = 0` (USD 120 total). They have replacement-fulfillment flags, so they need an operator review before any ticket is issued.

The existing read-only audit also found 15 unresolved/expired records with `Max poll attempts reached`; live transaction-list inspection confirms these are not uniform declines. Some are still `PENDING/PENDING`, some are `PENDING/FAILED`, and one recent initiation timeout is recorded as ambiguous. A failed poll therefore cannot be reported to a buyer as proof that no wallet debit occurred.

## Velocity contract and the implementation

Velocity’s [Accept payments guide](https://docs.velocityafrica.net/docs/guides/accept-payments/) defines this sequence:

1. `POST /sales-orders` creates an unpaid order and returns the sales-order trace.
2. `POST /transactions` initiates a payment. For EcoCash, `authType` is `REMOTE` and `debitPhone` is the customer account. The guide says `body.paymentStatus = SUCCESS` means initiation succeeded; it is not the final settlement result.
3. `PUT /transactions/poll/{transactionTrace}` is repeated until `body.pollStatus = SUCCESS`.
4. `PUT /sales-orders/update-workflow/{salesOrderTrace}` completes accounting. The guide says the sales order’s `body.salesOrder.status = PAID` confirms the lifecycle is complete.

TicketPulse follows that model in `services/velocity.ts` and `lib/velocity/reconciliation.ts`: it requires poll success, validates the amount, reads the sales order before calling the mutating workflow endpoint, and records a payment ledger entry under an order lock. Those changes are directionally correct and the focused suite passes (196 tests across 12 files).

## Evidence from production

The read-only script `scripts/audit-payment-failures.mjs` was run against the configured production database and Velocity API. A second read-only query inspected all 2,066 records returned by `GET /transactions` and matched them by sales-order ID.

Confirmed paid remotely but expired locally:

| Local order | Velocity result | Local protection |
| --- | --- | --- |
| `0aa773a9-0ad5-4985-8d58-0f31623edf00` | PAID, USD 40, outstanding 0 | possible replacement order |
| `de3c58f0-663b-46a2-9a79-e61e6b5899e4` | PAID, USD 40, outstanding 0 | possible replacement order |
| `58357758-5b6f-4e51-bd2e-656464631dc6` | PAID, USD 40, outstanding 0 | possible replacement order |

Representative unresolved EcoCash states:

- `9155dc83…`, `3592ec29…`, `759fad55…`, `99ca1632…`, and `d0756777…`: Velocity transaction `PENDING/PENDING`, sales order `UNPAID`.
- `98ec575e…` and `76c74f4d…`: transaction `PENDING/FAILED`, local manual review is set after repeated provider errors.
- `699c260d…`: the initiation request timed out after 15 seconds; the diagnostic correctly marks it ambiguous, while the discovered transaction is `FAILED/FAILED`.
- Historical examples `4fc66f56…` and `7c3ecb1e…` have error streaks of 91 and 112 respectively and are now stopped by the bounded retry policy.

### Screenshot case: `9155DC83`

The screenshot’s reference resolves to order `9155dc83-8b6a-43c4-b4ef-628ecc58621f`. Local metadata shows `paymentStatus = PENDING`, `pollStatus = PENDING`, HTTP 200, zero provider errors, and a valid transaction trace. A fresh read-only Velocity lookup confirms sales order `SORD-02145` is `UNPAID`, with `paidAmount = 0`, `outstandingAmount = 40`, and `payments = []`. This is a genuine unsettled payment, not a stale local display. The initiation was accepted, but Velocity has no applied payment yet; the customer either has not approved the EcoCash USSD prompt, the prompt was delivered to an incorrect/unavailable account, or the gateway has not completed the authorization. The merchant API cannot distinguish those three outcomes without Velocity’s gateway/USSD logs.

No order in the last-14-day cohort has `callbackProcessedAt`. This does not prove that Velocity sent no webhook, because successful recovery can settle before callback metadata is written, but it warrants verifying the webhook URL, secret/signature header, payload shape, and provider delivery logs. The callback currently requires `transactionTrace`, `salesOrderTrace`, and `pollStatus` at the top level.

## Root causes and risks

### 1. EcoCash retry can reuse the wrong phone and old payment attempt (high)

`findResumableOrder()` resumes any pending order for the same event and email within 30 minutes (`app/api/checkout/velocity/route.ts:640-664`). It does not require the same payment method, phone number, amount, or item set. A buyer who enters a wrong EcoCash number, then corrects it and retries, receives the old transaction instead of a new USSD initiation. This is the clearest code-level explanation for “EcoCash not working” reports after a retry.

### 2. Buyer polling ends after five minutes while the backend window is 24 hours (high)

The browser redirects after `POLL_TIMEOUT_MS = 5 minutes` (`app/checkout/page.tsx:128-135`). The backend payment window is 24 hours (`lib/velocity/poll-policy.ts`). The expired page now makes a status request and says “Awaiting payment confirmation” when appropriate, which reduces harm, but the buyer is still removed from active polling while a valid EcoCash authorization can remain pending.

### 3. Poll exhaustion is not a decline (high)

Velocity’s guide permits repeating the poll/payment cycle until the outstanding amount reaches zero. The implementation correctly stops after explicit “maximum poll attempts reached” or 20 consecutive provider errors, but it leaves the order pending/manual review. Operations and customer support must not equate `UNPOLLABLE`, `PROVIDER_ERROR`, or `PENDING/FAILED` with a declined wallet charge.

### 4. Historical paid orders require controlled recovery (high)

The recovery code protects paid, cancelled, refunded, and manually completed orders and checks for replacement orders before restoring inventory. That safety is necessary. The three live PAID/expired records therefore cannot be fixed by a blind batch; an operator must verify whether the related paid order already delivered tickets, then recover or refund exactly once.

### 5. The transaction discovery endpoint is broad and undocumented (medium)

`findVelocityTransaction()` downloads `GET /transactions`, caches it for 30 seconds, and filters locally. The live response contained 2,066 records. This is useful after an initiation timeout, but it increases latency and provider traffic, depends on an endpoint not described in the referenced guide, and may become incomplete if Velocity introduces pagination. Add a provider-supported lookup by sales order or implement pagination with explicit completeness checks.

### 6. Webhook configuration is unproven (medium/high)

The callback is strict: it requires `VELOCITY_WEBHOOK_SECRET`, accepts `x-webhook-signature` or `x-api-key`, rejects unknown transaction traces, and returns 503 to request provider retry. With zero callback metadata in the cohort, verify the deployed secret and header convention against Velocity’s dashboard and inspect delivery attempts. Do not infer webhook health from local order status alone.

### 7. Deployment and scheduler state are not proven (medium)

Source contains `/api/cron/tick`, which must run every minute and invoke `/api/cron/recheck-velocity` before expiry. The audit could not verify the deployed commit or Dokploy job through the available deployment API. A production check must confirm the running commit, a successful minute-by-minute tick, and that `recheck-velocity` is receiving the same `CRON_SECRET`.

## Recommended remediation order

1. Review the three PAID/expired IDs and their related replacement orders; issue tickets or refund only after duplicate-fulfillment checks.
2. Change resumable-order matching to include payment method, normalized EcoCash phone, amount/currency, and a stable cart fingerprint. If the phone changes, create a new transaction against the same sales order only under an idempotent lock.
3. Replace the five-minute hard redirect with an “awaiting confirmation” state that continues server-side reconciliation and gives the buyer a refresh/status link. Never tell the buyer that a reservation was released unless the backend has verified it.
4. Verify Velocity webhook registration, secret, signature header, and callback payload using provider logs; capture a redacted callback receipt and correlate it to a test order.
5. Ask Velocity for representative transaction outcomes for the pending/failed traces, the exact poll allowance, EcoCash USSD decline/timeout reasons, and a supported sales-order transaction lookup.
6. Add dashboards/alerts for: initiation timeout rate, pending age, `UNPOLLABLE` count, callback 4xx/5xx, sales-order PAID with local non-paid status, and retry attempts with changed phone numbers.

## Verification limits

This audit initiated no payments and changed no orders, inventory, ledger entries, provider workflows, or notifications. A sales order reported `UNPAID` is evidence that Velocity has not applied a payment to that order; it is not proof that a customer’s mobile wallet was never debited. The running deployment and provider webhook delivery history still require direct verification.
