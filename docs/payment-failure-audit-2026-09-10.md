# Payment failure audit — 10 September 2026

Scope: production orders created in the preceding 14 days, current Velocity sales-order GET responses, and source at commit bf92c66. No orders, provider workflows, or notifications were changed during this audit. The read-only reproduction script is `scripts/audit-payment-failures.mjs`.

## Findings from production

| Method | Paid | Completed | Pending | Expired | Total |
| --- | ---: | ---: | ---: | ---: | ---: |
| EcoCash | 5 | 20 | 3 | 12 | 40 |
| Visa/Mastercard | 8 | 1 | 0 | 5 | 14 |

These are order states, not a bank-charge success rate. Abandoned checkouts and manually verified payments are mixed into these counts. Twenty EcoCash orders have manual-completion metadata; automated settlement cannot be inferred from their completed status.

All 20 pending/expired orders were compared with Velocity using read-only sales-order lookups. Every lookup returned HTTP 200 with matching sales-order ID and trace. Four were PAID for exactly USD 40 with zero outstanding; 16 were UNPAID with zero applied payment. Fifteen of those unresolved/expired records retained a maximum-poll-attempt error.

### Four additional paid orders still expired locally

| Order | Velocity | Local |
| --- | --- | --- |
| 0aa773a9-0ad5-4985-8d58-0f31623edf00 | PAID, USD 40, outstanding 0 | expired |
| 825605f2-9489-4fb7-9a88-b69c3739dad5 | PAID, USD 40, outstanding 0 | expired |
| de3c58f0-663b-46a2-9a79-e61e6b5899e4 | PAID, USD 40, outstanding 0 | expired |
| 58357758-5b6f-4e51-bd2e-656464631dc6 | PAID, USD 40, outstanding 0 | expired |

All four lack transaction traces. They are separate from the three recovered earlier in this conversation. Before issuing additional tickets, check for manual/replacement orders and existing attendee tickets for these buyers.

## Causes and remaining defects

1. **Successful charges can lose their local transaction reference.** Checkout saves the sales-order reference before calling initiation, which has a default 15-second timeout. A timeout after Velocity accepts a request can leave a real charge with no transaction trace locally. Four additional PAID/no-trace orders prove that missing traces do not establish payment failure. Logs are needed to distinguish timeouts, malformed responses, and persistence failures for each case; the metadata does not preserve that cause.

2. **Polling exhaustion is a provider/workflow failure, not proof of a declined charge.** Fifteen unresolved records retain `Max poll attempts reached`. EcoCash examples include error streaks of 91 and 112. The old browser loop checked every two seconds and did not share the cron stop guard. Shared automatic polling throttling and stop guards were recently added. Velocity's actual allowance and individual gateway decline/USSD outcomes remain unverified.

3. **Initiation success was treated as settlement success.** The previous normalizer accepted `paymentStatus: SUCCESS` even while `pollStatus` was pending or failed; its cache could then avoid further real polling. The recent correction requires poll success or a separately verified fully paid sales order. Velocity's guide explicitly distinguishes these stages: https://docs.velocityafrica.net/docs/guides/accept-payments/#update-sales-order .

4. **Checkout falsely presents expiry after 5.5 minutes.** `app/checkout/page.tsx` redirects to `/checkout/expired` when its local timer ends. That page asserts that the reservation has been released and offers Try again, without verifying the backend order. The backend payment window is 24 hours. This can cause confusion and repeated payment attempts. It should display still-awaiting-confirmation and query real status before claiming expiry.

5. **Previously expired paid orders are outside the regular recovery batch.** The new read-only sales-order recovery runs for pending/awaiting-verification candidates. The cron does not select historical expired orders, and the buyer status endpoint returns expired immediately. The four historical PAID orders therefore need a bounded backfill with manual-completion, replacement-order and duplicate-ticket protection. Merely deploying the recent patch will not automatically sweep them.

6. **The sales-order lookup runs before the shared polling cooldown.** The new recovery check can issue a GET on every two-second browser status request even though transaction PUT polls are throttled. It does not spend transaction poll attempts, but adds provider traffic and latency. Add a separate read-check cooldown and avoid letting a transient GET error prevent all eligible transaction checks indefinitely.

7. **Initiation error classification is too broad.** The checkout catch only treats errors prefixed `Network error communicating with Velocity Africa` as ambiguous. HTTP 5xx/non-JSON errors may also occur after upstream processing, but currently take the cancellation path. That path releases reservations without the shared order-mutation lock and reads no current paid status first. A simultaneous settlement can therefore race with cancellation. This is a source-level risk; this audit did not establish a specific affected charge.

8. **No recorded callback completions in this cohort.** Neither method has `callbackProcessedAt` in the last-14-day metadata. This does not prove no webhook was received: it warrants checking provider webhook registration, signature configuration, payload format and endpoint logs. The callback expects a secret and three top-level fields. New local PAID guards can also return before setting callback metadata.

9. **Database failure can masquerade as delivery already in progress.** `acquireLock()` returns false on database connection errors as well as actual contention. Delivery then reports `IN_PROGRESS`, success true, zero tickets. This behavior was observed in CLI logs today. It should return an explicit retryable infrastructure error when lock acquisition fails.

10. **Timezone-dependent age checks.** Production `orders.created_at` and `updated_at` are timestamp-without-time-zone; PostgreSQL reports Etc/UTC, while the operator's Node runtime uses Europe/Paris. Driver parsing consequently shifts displayed instants by two hours for UTC-written values. SQL-based 14-day cohort selection avoids client parsing, but JavaScript age checks can differ across runtimes. Confirm production TZ and standardize timestamp handling before relying on precise expiry durations.

## Verification limits

Dokploy project listing identified the TicketPulse production frontend as `pw1vA9QYoYsOQMPWYS962`. Deployment-list and payment-log calls returned HTTP 400, so the running commit and initiation logs could not be verified through those CLI endpoints. Source findings describe the checked-out/pushed code, not proven deployment state. No new payment was initiated to test a buyer charge. An UNPAID sales-order balance is not conclusive proof that a customer's wallet was never debited.

## Recommended order of work

1. Review and safely recover the four confirmed paid historical orders, excluding manual/replacement fulfillment.
2. Verify the deployed commit and cron/webhook operation.
3. Correct misleading five-minute expiry UI, preserve ambiguous initiation results, and serialize cancellation with settlement.
4. Throttle sales-order GET recovery, report lock/network failures accurately, and store structured initiation diagnostics without secrets.
5. Ask Velocity for initiation/USSD outcomes, exact polling allowance, webhook delivery logs and payment-application timelines for representative traces. The merchant-facing API alone does not expose why a customer's wallet authorization failed.
