# Buyer journey and EcoCash audit

**Date:** 1 October 2026, Africa/Harare. **Source:** `ticketpulse`, HEAD `ed637c8` plus the existing working tree. **Purpose:** original checkout audit snapshot at HEAD `ed637c8`; post-audit implementation changes and verification are recorded in the follow-up section.

## Verdict

TicketPulse has a useful foundation: guest checkout, EcoCash approval on the phone, card checkout, server reconciliation, guarded inventory reservation, signed ticket links, PDF delivery, wallet options, and replacement-fulfillment checks. Payment reliability has improved since the September audit.

The experience still loses trust at the boundaries between **an order being created, a payment request being accepted, payment being confirmed, and a usable ticket being delivered**. A better-looking checkout alone will not solve that. The first work should secure ticket recovery, make every status truthful, prevent additional payment attempts while an earlier attempt is unresolved, and confirm the final amount before requesting approval.

The most serious finding is public email lookup issuing signed ticket links without verifying possession of that email address. Other high-priority findings include retry/idempotency gaps, stale or incorrectly mapped order status, misleading cancellation, price changes without a second review, and capacity-unchecked recovery of expired paid orders.

## Scope and evidence

Reviewed event discovery/detail and selection, cart storage, web checkout, checkout/status/return handlers, Velocity service and reconciliation, expiry and historical recovery, callback authentication, ticket access and delivery, Flutter buyer checkout, and the WhatsApp checkout handoff. Inspected the existing Flutter event, payment and purchase-success PNGs; these are sample artifacts, not evidence of the current production rendering.

Read current official Velocity documentation through the browser. The earlier `/docs/guides/accept-payments/` URL returns a 404. The current guide is [Accept payments](https://docs.velocityafrica.net/docs/guides/online-payments/accept-payments).

Ran:

```text
npm test -- test/services/velocity.test.ts test/lib/velocity test/api/checkout/velocity test/lib/order-access.test.ts test/api/mobile/orders.test.ts test/api/mobile/order-detail.test.ts
```

**Result: 15 files, 221 tests passed.** These are local tests, largely with mocks. No live wallet charge, production database audit, callback delivery test, deployment verification or full browser purchase was performed. September production counts are historical evidence and are not presented as current performance. Existing unrelated modifications were preserved.

**Priority:** P0 = close immediately; P1 = next reliability release; P2 = experience and operational improvements. Findings marked *risk* describe a code path or missing guard, not a proven production incident.

## Prioritized findings

### 1. P0 — Ticket recovery trusts knowledge of an email address

**Evidence:** `app/orders/lookup/page.tsx:28` queries orders from a submitted email; `:52` creates signed order links for those results. `lib/order-access.ts:99` also accepts a caller-supplied matching email as ownership. `app/api/orders/[id]/tickets/route.ts:20` relies on that helper before exposing admission QR credentials.

**Buyer impact:** someone who knows a buyer's email can use the public lookup to obtain signed links, discover order IDs, and access tickets without proving control of the inbox. This is stronger evidence than simply guessing an order UUID. No production exploitation was attempted.

**Improve:** send a short-lived magic link or OTP to the checkout email, return the same generic response for all addresses, and grant an order-scoped session only after verification. Remove the raw-email ownership bypass. Checkout should issue a scoped guest capability immediately so secure access does not add a login step to purchasing. Keep signed email links, with explicit scope and expiry appropriate to ticket access and transfers.

**Acceptance:** entering a known email reveals neither orders nor signed links; arbitrary `x-order-email` is insufficient; the real buyer can recover tickets across devices after one inbox verification. Rate-limit lookup and verification.

### 2. P1 — Resume matching is improved but still leaves duplicate-attempt gaps

**Evidence:** `app/api/checkout/velocity/route.ts:645` fingerprints `parsed.phone.trim()` rather than the normalized number. The fingerprint is required by the SQL query at `:678`, before the normalized comparison at `:685`. Orders older than 30 minutes are excluded at `:679`, while `lib/velocity/poll-policy.ts:1` allows a 24-hour payment window. The initial resume query at `:698` precedes the creation lock at `:753`; there is no second resume check inside the creation transaction. A separate contention fallback exists at `:883`.

**Risk:** `077…` and `+26377…` can represent the same wallet but produce different fingerprints. An unresolved order can stop being resumable long before payment reconciliation ends. Two requests can both miss the initial lookup, with the second acquiring the event lock after the first commits and creating another order. The lock protects inventory but is not a durable request-identity constraint. Correcting a phone or switching methods currently creates a separate order while the previous attempt may still complete.

**Improve:** use a durable client request key and a database uniqueness guard; normalize phones and canonicalize aggregated cart lines before fingerprinting. Recheck identity within the transaction. Track payment attempts under one order. Resume an existing unresolved attempt by its explicit ID; safely reconcile or establish terminal failure before starting a replacement. A buyer choosing to buy again must still be able to create a deliberately new purchase.

**Acceptance:** concurrent same-key POSTs produce one order and at most one initiating transaction; equivalent phone formats resume; refreshing after 31 minutes does not silently create another charge request; changed-phone recovery clearly explains the previous attempt's state.

### 3. P1 — “Cancel payment” only dismisses the screen

**Evidence:** `app/checkout/page.tsx:375` clears local polling state and says “Payment cancelled. You can try again.” `:813` labels that action “Cancel payment”. No cancellation request is sent; Escape invokes it at `:749`.

**Buyer impact:** the phone approval and backend reconciliation can remain active while the buyer believes the transaction has been cancelled. Retrying or switching methods can produce overlapping attempts.

**Improve:** call this “Continue in background” or “View payment status”; retain the order and show that payment may complete. Offer a real cancellation action only if Velocity confirms a supported cancellation contract and the result is verified.

**Acceptance:** closing or pressing Escape never asserts financial cancellation; returning restores the same attempt and a visible status link.

### 4. P1 — Processing and cancelled orders can be displayed as refunded

**Evidence:** `lib/order-data.ts:37` maps paid, completed, pending and expired explicitly, then maps **every other status** to refunded. Thus `awaiting_verification` and `cancelled` are mislabeled.

**Buyer impact:** an unresolved payment can appear refunded even when no refund has occurred. A cancelled order is also not a refund receipt.

**Improve:** use an explicit exhaustive buyer-state mapping shared by web and mobile. Preserve pending confirmation, cancellation, refund requested, refund processing, refunded and manual review as distinct states. Unknown internal values must show a neutral status requiring refresh.

**Acceptance:** each database status has a tested display mapping; refunded appears only when a refund is actually recorded.

### 5. P1 — Order pages can prefer stale local data over the server

**Evidence:** `app/orders/[id]/page.tsx:85` returns early for any saved order whose status is not pending. `lib/cart-context.tsx:133` builds saved orders from the current cart and its totals. Web checkout does not adopt the authoritative response amount before saving (`app/checkout/page.tsx:321`). Order recovery calls `placeOrder` again at `app/orders/[id]/page.tsx:138`, which snapshots the current cart and clears it.

**Buyer impact:** refund/expiry changes may not appear; the receipt can retain a pre-promo or stale total. Revisiting a card-return URL can duplicate the local history entry and clear an unrelated cart. The server ticket endpoint may reject or omit tickets while the locally displayed order still says paid.

**Improve:** always refresh the authoritative order; use local data only as a temporary loading cache. Upsert the server snapshot by order ID. Separate saving an order from clearing the purchased cart, and clear only the matching cart revision.

**Acceptance:** a refund updates on reload; displayed total equals the stored order total; revisiting a return URL neither duplicates history nor removes new cart items.

### 6. P1 — Displayed price can differ from the amount requested from the wallet

**Evidence:** `components/events/TicketSelector.tsx:111` copies the effective price into the cart. `lib/cart-context.tsx:97` increments an existing line's quantity without repricing it; `:108` changes quantity without repricing. Checkout recalculates early-bird/group pricing at `app/api/checkout/velocity/route.ts:553`. The web pay label uses cart totals at `app/checkout/page.tsx:251` and immediately initiates through the POST.

**Buyer impact:** an early-bird price may expire, a quantity change may cross a group threshold, or repeated additions may preserve an obsolete unit price. The buyer can approve an amount different from the one on the pay button.

**Improve:** introduce an authoritative quote with item totals, discounts, currency, relevant fees and expiry. Review the quote before initiation; if it changes, display the difference and obtain a fresh pay click. Use integer minor units for monetary calculations. Treat client prices as estimates until quoted.

**Acceptance:** expiring an early-bird price, crossing a group threshold and changing a tier price cannot initiate a higher amount without showing it first.

### 7. P1 — A promo can disappear silently during checkout

**Evidence:** `app/api/checkout/validate-promo/route.ts` validates availability but receives no cart amount and does not check the minimum purchase. `app/api/checkout/velocity/route.ts:590` checks that minimum, expiry and max uses, but simply skips an invalid promo and proceeds at full price. `:869` increments usage without a conditional maximum-use guard in that update.

**Risk:** a buyer sees a discount and submits, but the wallet request can be full price. Different event transactions can race for a usage-limited code if other writers are not under the same lock.

**Improve:** validate against the server quote; reject changed promo eligibility with a specific message before requesting payment. Claim capped usage atomically, with a rollback/release policy for abandoned attempts.

**Acceptance:** expired, minimum-not-met or exhausted promos require a new price review. Concurrent claims cannot exceed the configured cap.

### 8. P1 — Payment timing and terminal responses are inconsistent

**Evidence:** browser countdown is 5.5 minutes (`app/checkout/page.tsx:42`), status-handler transition is five minutes (`app/api/checkout/velocity/status/[id]/route.ts:23`), provider poll cooldown is one minute and the payment window is 24 hours (`lib/velocity/poll-policy.ts`). The overlay says “Approve now … left” (`app/checkout/page.tsx:803`). After a failed result beyond five minutes, the status handler calls expiry and returns `status: expired` without checking whether expiry actually succeeded (`app/api/checkout/velocity/status/[id]/route.ts:145`). The expiry helper can return false when it cannot prove the order safely closable.

**Buyer impact:** a browser waiting timer looks like a wallet authorization deadline. A response can claim expiry despite the database still being pending or recovering to paid. The recovery page is better than September's version and now polls, but the overall contract is still inconsistent.

**Improve:** define separate `reservationExpiresAt`, `nextCheckAt` and any provider-verified approval deadline. Browser timeout should transition to “Still checking”, not determine payment outcome. Reload the actual state after every expiry attempt; only return expired when the database confirms it.

**Acceptance:** simulated provider outages and late settlement never yield a false terminal response; the countdown describes only a real deadline.

### 9. P1 — Historical recovery can restore inventory past capacity

**Evidence:** `lib/velocity/sales-order-recovery.ts:79` restores inventory for an expired paid order after replacement checks. `lib/order-expiry.ts:36` increments tier sold quantity without a capacity predicate. The historical cron performs this automatically (`app/api/cron/recheck-velocity/route.ts:27`). Initial checkout, in contrast, has an atomic capacity cap.

**Risk:** an old reservation is released, remaining seats sell, then a late paid order is recovered and tickets are issued beyond capacity. Replacement-buyer checks do not establish remaining venue capacity.

**Improve:** atomically reserve available capacity before restoring fulfillment. If capacity is unavailable, preserve payment evidence and create an urgent fulfillment/refund review; never pretend the payment failed. Define handling for recovery after the event has ended as well.

**Acceptance:** recovery when a tier is full cannot create an additional admission ticket; the buyer receives a clear, tracked resolution.

### 10. P1 — Delayed payment errors lose the recovery reference

**Evidence:** checkout's non-OK parser at `app/checkout/page.tsx:312` retains only `error`. Recoverable card failures return `orderId` and `recoverable` at `app/api/checkout/velocity/route.ts:1329`; the UI discards those fields, and `errorOrderId` is never populated. The missing-trace branch at `:1255` returns no order ID and, for cards, asserts “No charge has been made” despite a missing response reference being insufficient evidence.

**Improve:** return structured buyer-safe errors with order ID, access capability, retryability and status URL. Preserve these on web/mobile. Distinguish validation failure before initiation from an ambiguous upstream result. Remove unsupported no-charge claims.

**Acceptance:** every ambiguous or recoverable initiation result leaves the buyer with a working status link and warns against a second payment.

### 11. P2 — Refresh and storage failures weaken the approval experience

**Evidence:** refresh restores `pollingContact` but not `form` (`app/checkout/page.tsx:76`); the overlay receives `form.phone`/`form.payment` at `:371`. Direct sessionStorage access in polling and analytics (`:116`, `:733`) is outside the guarded storage helpers. Status fetches do not check `res.ok` or surface 403/429; network errors are silently retried.

**Buyer impact:** a restored overlay can show an empty phone or the wrong method. Unavailable local storage can prevent guest status authorization; a client fetch with no deadline can stall progress. Support errors can sit behind a full-screen overlay that has no dialog semantics or focus management.

**Improve:** render from a durable server attempt snapshot, retain credentials independently of optional storage, use request deadlines and respect Retry-After. Show offline/access-expired messages inside the status panel. Add focus trapping, accessible headings and polite announcements; keep help and the charged amount visible.

**Acceptance:** refresh preserves the exact method, amount and masked phone; storage-disabled and offline cases show recoverable states; keyboard users can navigate status and support.

### 12. P2 — Card recovery creates new transactions before using the documented recovery API

**Evidence:** `recoverCardRedirectUrl` at `app/api/checkout/velocity/route.ts:84` polls and then reinitiates. Initial checkout can initiate up to three card transactions (`:1120`). `services/velocity.ts` retains a session reference but has no dedicated redirect-URL retrieval method.

**Improve:** use the documented [Get Redirect URL](https://docs.velocityafrica.net/docs/api-reference/transactions/get-redirect-url) endpoint when an authoritative session ID is available: `GET /transactions/public/redirect-url/{sessionId}`. Confirm the session field and response schema with Velocity; do not guess from arbitrary URLs. Reconcile existing attempts before creating another. Validate redirect hosts against the provider's approved hosted gateways.

**Acceptance:** recovering a valid session performs no new payment initiation; an unavailable session produces a clear recoverable state.

### 13. P1/P2 — Mobile and WhatsApp cannot complete all event configurations

**Evidence:** required questions are enforced by checkout at `app/api/checkout/velocity/route.ts:609`, but Flutter's `startCheckout` payload (`flutter_organizer/lib/data/api.dart:309`) and the WhatsApp handoff (`lib/whatsapp-checkout.ts:357`) have no question responses. They also have no promo entry in these paths. Flutter holds `_checkout` in widget memory, polls for 30 iterations and does not persist the attempt in this screen (`flutter_organizer/lib/screens/buyer/checkout.dart:33`, `:118`). Success offers “Back to events” rather than opening tickets. WhatsApp maps errors to a cancelled session and encourages restarting at `lib/whatsapp-checkout.ts:371`, `:387`; its expired/failed message at `:411` lacks a wallet-debit caveat.

**Buyer impact:** events with required questions can work on web but fail in the other channels. Leaving or restarting the app loses the visible recovery context. WhatsApp restarts can encourage another payment after an ambiguous result. A free order receives the same phone-approval messaging unless handled separately.

**Improve:** either support the common quote/questions/promo contract or hand off to a prefilled secure web checkout before starting a payment. Persist active attempts, refresh on app resume, and open the order/tickets after success. Reuse the same safe delayed/failure copy in WhatsApp. Explicitly handle free orders without a payment prompt.

**Acceptance:** required-question and free events work in every advertised channel; app restart restores a pending order; confirmed purchase opens usable tickets.

### 14. P2 — Payment confirmation is ahead of the visible ticket experience

**Evidence:** paid status returns without ticket-delivery state; `lib/use-order-tickets.ts:38` polls empty ticket results for only 30 seconds and collapses failed requests to an empty array. At `app/orders/[id]/page.tsx:420`, the fallback says “Ticket QR unavailable — check your email”. The mobile success preview similarly sends buyers to email instead of providing the ticket.

**Improve:** return payment, ticket issuance and channel-delivery states separately. Immediately show “Payment confirmed — preparing your tickets”, then render actual tickets with PDF/wallet/offline options. If email fails, keep tickets usable in the app and offer resend. Surface partial ticket issuance by expected versus issued count; retain a manual refresh action after the polling window.

**Acceptance:** confirmed payment with email failure still gives access to valid tickets; authorization, network failure and ticket-generation failure have different messages.

### 15. P2 — Trust copy and fee disclosure need one consistent story

**Evidence:** payment method copy promises “instant confirmation” (`app/checkout/page.tsx:35`) beside a permanent delayed-confirmation notice. The current [Velocity website](https://velocityafrica.net/#pricing) lists customer acquiring fees and possible additional issuer fees. The local checkout displays the order total without an explicit provider-fee breakdown.

**Improve:** verify the merchant agreement and actual debit behavior before quoting a fee. Clearly distinguish ticket total, any provider charge and total wallet debit; if issuer fees cannot be known, state that accurately. Do not hardcode public website rates as this merchant's contract. Use “Approve on your phone” instead of promising instant confirmation. Show the service notice only from a maintained incident state.

**Acceptance:** the buyer understands the amount being approved and why a wallet debit may differ; normal checkout does not simultaneously promise instant payment and advertise delay.

### 16. P2 — The funnel cannot reliably locate abandonment

**Evidence:** `CHECKOUT_STARTED`, `BUYER_DETAILS_SUBMITTED` and `PAYMENT_METHOD_SELECTED` are emitted together after order creation (`app/api/checkout/velocity/route.ts:951`). A visitor who opens checkout and abandons before submission never reaches those events. `lib/analytics.ts` groups raw event counts and computes success as `confirmed / (initiated + failed)`, which double-counts failed initiated attempts in the denominator. Free confirmation does not have a payment-initiation event.

**Improve:** record actual stage transitions; dedupe by journey/order/attempt as appropriate. Separate orders, payment attempts and individual tickets. Define confirmed paid attempts divided by eligible initiated paid attempts, with pending outcomes explicit. Segment by channel, currency, method, device and error class; avoid storing raw wallet numbers in analytics.

**Acceptance:** one failed initiated attempt contributes one denominator entry; free purchases have their own conversion measure; pre-submit abandonment is visible.

### 17. P2 — Tests give incomplete assurance for the buyer journey

**Evidence:** `test/api/checkout/velocity/order-resume.test.ts:12` tests a local `simulateFindResumable` function rather than the actual handler, and models older event/email/30-minute behavior. `e2e/critical-journeys.spec.ts` covers reachability and organizer flows but not a paid buyer purchase.

**Improve:** test the real checkout handler with a provider stub and a real disposable database for concurrency. Add browser/mobile journey coverage for approval delay, refresh, back/close, duplicate submit, corrected phone, expired promo, required questions, offline checks, delivery failure and cross-device recovery. Use Velocity sandbox for provider contract checks.

**Acceptance:** tests fail when the real resume query/transaction guard is broken; duplicate initiation is measured directly; production charges are unnecessary for routine verification.

## Velocity API alignment

The current [Accept payments guide](https://docs.velocityafrica.net/docs/guides/online-payments/accept-payments) describes creating a sales order, initiating a transaction and polling the transaction trace. EcoCash uses `ECOCASH` and `REMOTE`; card uses `VMC` and `WEB`. Initiation `paymentStatus: SUCCESS` is not final payment proof; final outcome uses `pollStatus`. TicketPulse correctly separates these in its normalizer. The current guide ends at polling; do not cite it as specifying a mandatory fourth step. Workflow update has its own reference.

| Operation | Current official reference | Integration recommendation |
| --- | --- | --- |
| API keys and sandbox | [Introduction](https://docs.velocityafrica.net/docs/intro) | Server-held X-API-Key; use sandbox for reproducible contract tests. |
| Initiate EcoCash | [EcoCash Transaction](https://docs.velocityafrica.net/docs/api-reference/transactions/ecocash-transaction) | Validate/normalize the wallet before order/provider work. Retain request identity and full attempt correlation. |
| Initiate hosted card payment | [VMC Transaction](https://docs.velocityafrica.net/docs/api-reference/transactions/vmc-transaction) | Documented optional `successUrl`/`cancelUrl`; verify any reliance on `returnUrl`. Returning to the website is never payment proof. |
| Poll final transaction result | [Poll Transaction](https://docs.velocityafrica.net/docs/api-reference/transactions/poll-transaction) | PUT by transaction trace; retain shared throttling and distinguish transport errors from outcomes. Confirm attempt limits with Velocity. |
| Recover hosted checkout | [Get Redirect URL](https://docs.velocityafrica.net/docs/api-reference/transactions/get-redirect-url) | Public GET by session ID; prefer recovery of an existing session over creating another transaction. |
| Discover lost transaction reference | [List Transactions](https://docs.velocityafrica.net/docs/api-reference/transactions/list-transactions) | GET /transactions is now documented, unlike the September report's description. The page supplies no pagination/filter contract; bounded discovery still needs provider confirmation. |
| Verify sales-order balance | [Get Sales Order](https://docs.velocityafrica.net/docs/api-reference/sales-orders/get-sales-order) | Match ID, trace, total, currency, paid amount and outstanding balance. |
| Advance workflow | [Update Sales Order Workflow](https://docs.velocityafrica.net/docs/api-reference/sales-orders/update-sales-order-workflow) | Endpoint remains documented with no body. Keep read-before-update and serialization; the page does not guarantee idempotency. |

The reference pages have inconsistencies: some describe an Authorization header while their curl examples use X-API-Key; the EcoCash example phone contains an extra local zero; response schemas and polling limits are sparse. These are reasons to obtain a versioned contract, not to blindly copy example formatting.

**Questions to resolve with Velocity:** canonical phone/credit-account formats; exact debitRef uniqueness and idempotency behavior; initiation timeout recovery; terminal EcoCash outcome meanings and approval validity; recommended polling cadence and allowance; redirect session schema; filtered transaction lookup/pagination; workflow-update retry/idempotency rules; webhook registration, actual payload, authentication, replay handling and delivery retries; refund support and authoritative completion evidence; merchant-specific customer fees. No webhook HMAC algorithm or refund endpoint is assumed from another provider's documentation. The callback currently compares a static header value to a secret; whether that matches Velocity's contract is unverified.

## Proposed buyer experience

1. **Discover:** event cards communicate date/time, venue, lowest available price and availability. Event detail prioritizes lineup/description, ticket benefits, organizer, directions and refund/access information. The sample mobile event preview uses a large placeholder poster; provide a deliberate compact fallback so useful information stays above the fold.
2. **Select:** one event/currency per checkout, enforced as items are added. Keep quantity controls and the total close together. Explain early-bird/group rules. Reprice on changes and show unavailable tiers with alternatives or a waitlist.
3. **Review:** a compact authoritative summary: event, date, tier, quantity, promo, fees and final amount. Prefill known contact details. Explain that the EcoCash wallet number can differ from the ticket recipient. Confirm the normalized number before the prompt.
4. **Approve:** “Approve USD X on EcoCash ending 4567.” Show the order reference, status, “Didn't receive a prompt?” help and background-check option. Never collect the EcoCash PIN in TicketPulse. A resend/correct-number action must first resolve the existing attempt safely.
5. **Wait:** clear progression from starting request to awaiting approval to checking confirmation. After a reasonable waiting period: “We’re still checking. You can leave this page; we’ll notify you. Please don’t pay again.” Preserve a secure status link. Update cadence can back off while the server continues reconciliation.
6. **Receive:** “Payment confirmed” immediately, then real QR tickets. Primary action is “View tickets”; PDF, wallet and share/transfer follow. The mobile success sample currently prioritizes “Back to events”; reverse that hierarchy. Email is a delivery channel, not the only route to attendance.
7. **Recover:** OTP/magic-link lookup, a visible payment-and-delivery timeline, reference-prefilled WhatsApp help, expected response time and a tracked support case. Keep pending confirmation, payment failure and refund processing distinct.
8. **Attend:** offline ticket availability, clear venue/time/access instructions, ticket-holder and transfer status, and a reliable scan result. Measure purchase-to-issued-ticket separately from check-in.

**Proposed buyer-state contract:** `creating_order`, `awaiting_approval`, `confirming_payment`, `confirmation_delayed`, `payment_failed`, `payment_confirmed`, `preparing_tickets`, `tickets_ready`, `cancelled`, `expired`, `refund_processing`, `refunded`. These are proposed display states; provider values remain separate. Derive them from server evidence rather than browser timers. Return amount/currency, masked wallet, safe next actions, status URL, next-check time, relevant expiry, issued/expected ticket counts and delivery state.

## Delivery plan

| Order | Work | Release gate |
| --- | --- | --- |
| Immediate | Close public email ticket access and add secure guest recovery | Known email alone cannot reveal a ticket or signed link. |
| Reliability release | Durable checkout identity, truthful cancellation/status, explicit state mapping, authoritative order refresh, safe historical capacity recovery | Concurrent/retry/late-payment tests pass; no false cancelled/expired/refunded state. |
| Checkout release | Quote-before-initiation, promo validation, phone confirmation, structured recovery errors | Displayed approved amount matches the request; every unresolved attempt has a recovery path. |
| Channel release | Flutter/WhatsApp questions or web handoff, active-attempt persistence, ticket-first confirmation | Required-question, free, delayed and restart journeys pass on advertised channels. |
| Operational release | Provider contract fixtures, webhook/cron checks, delivery status, corrected metrics and incident-driven notices | Provider contract verified in sandbox; overdue payment/delivery work is observable. |

Keep the existing reconciliation safeguards while redesigning presentation. Avoid shortening the 24-hour window merely to match a browser countdown: separate inventory reservation from payment investigation and define what happens if payment completes after seats are released.

## Operational validation and success measures

Before attributing live conversion problems to EcoCash, verify the running commit, one-minute scheduler health, callback delivery/authentication using redacted evidence, active inventory/ledger migrations, and actual provider outcomes for a small consented sandbox/test cohort. The passing unit suite cannot establish any of those.

Track per attempt: initiation latency, confirmation latency p50/p95, unresolved age, ambiguous initiation rate, duplicate initiation/settlement, provider paid/local unpaid, local paid/tickets missing, ticket delivery latency, recovery completion, support-contact rate and abandoned checkout stage. Separate USD/ZWG, free/paid, web/mobile/WhatsApp and methods.

Proposed initial alerts: any duplicate settlement or admission-capacity breach; confirmed payment with no issued tickets after two minutes; pending confirmation needing attention after ten minutes; overdue manual reviews; missing scheduler heartbeat; growing callback 4xx/5xx. Tune time thresholds after collecting a baseline and agreeing service targets. Zero duplicate charges, zero false financial outcomes and secure ticket access are invariants, not conversion experiments.

## Implementation follow-up — 1 October 2026

The user requested implementation of the buyer-journey fixes. This follow-up records code changes made after the audit snapshot above; it does not change the audit’s findings about the original checkout.

- Guest order access now requires a signed order capability or an authenticated owner. Email lookup sends a short-lived signed recovery link after rate-limited inbox verification.
- Checkout quotes the server-calculated amount before initiation, validates promo eligibility and minimum spend, confirms the amount and currency on the subsequent request, and locks inventory and reprices ticket/merch lines before order creation. A durable checkout request ID is stored in a unique metadata index. Pending attempts can be recovered before checking current stock or sale-window availability.
- Ambiguous provider outcomes keep their order reference and signed recovery link. A missing card redirect is looked up against the existing Velocity hosted session instead of starting another payment. The documented public redirect lookup is implemented as an HTTPS-only GET; this path has a mocked response test, not a live merchant sandbox verification.
- Late payment recovery checks remaining ticket/merch capacity before restoring stock; unavailable inventory leaves the paid order in reconciliation review. Buyer status mapping preserves cancelled and verification states. The order view refreshes canonical server state and distinguishes missing or delayed tickets.
- Web, Flutter and WhatsApp buyer checkout now use amount review and signed order recovery. The WhatsApp flow hands attendee-question events to web checkout so required answers remain available. Provider fees are disclosed without assuming a merchant contract rate. Persistent notices can be shown through an incident message setting.
- Funnel stages now emit at the actual checkout interactions; metrics count unique orders/sessions and avoid adding failed attempts to the payment initiation denominator. Ticket and check-in rows are labeled as order counts.

Validation completed locally: production Next.js build and type check passed; 410 Vitest tests passed, with an additional focused 14-test checkout/recovery run; desktop Chromium and mobile Chromium buyer flows passed (four Playwright cases); all 23 Flutter tests passed, including two buyer-checkout API tests; focused ESLint reported no errors. The build logs expected database-connection warnings because this workspace has no DATABASE_URL; no database migration or live Velocity payment was run.

Before rollout, apply db/migrations/0010_checkout_request_identity.sql through the normal migration process, deploy web and Flutter changes together, and verify the hosted-redirect response and EcoCash/card outcomes against the merchant’s Velocity sandbox. This local work does not confirm production migration state, provider behavior, or historic payment reconciliation.

## What has improved since September

Current source adds method/cart/amount matching for resumption, conservative ambiguous-error handling, sales-order lookup throttling, locked cancellation, explicit lock infrastructure failures, status checks on the delayed page, and a bounded historical-expired-order recovery sweep. These older findings should not be repeated as wholly unfixed. Remaining issues above describe current code and gaps between those safeguards and what buyers see.

The September production findings still warrant operator reconciliation if unresolved, but their recorded IDs and counts were not rechecked in this audit. No current claim is made about wallet success rate, webhook delivery health, deployed migrations or paid historical orders.
