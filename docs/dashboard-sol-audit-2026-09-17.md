# Sol audit: Organizer and Super Admin dashboards

**Date:** 17 September 2026  
**Scope:** `/organizer`, `/organizer/orders`, event-management shell, `/admin`, `/admin/organizers`, `/admin/orders`, `/admin/payments`, `/admin/reconciliation`, `/admin/analytics`, shared dashboard navigation, and the revenue helpers used by those surfaces.  
**Mode:** Read-only source and interaction audit. No data, payment, organizer, or permission state was changed.

## Executive assessment

The product has broad operational coverage, but the two dashboards currently behave like collections of pages rather than one dependable operations system. The largest risk is that the admin surface can show a different financial truth from the organizer payout ledger. The largest workflow risk is that exception queues report counts that do not always match the rows or links an operator can act on. The largest UX risk is duplicate navigation on mobile and a dead `/organizer/events` destination.

The implementation should be sequenced as:

1. **Protect state and financial truth.** Validate admin action targets, make queue counts and payout statuses canonical, and remove non-canonical revenue queries.
2. **Make work queues actionable.** Give every alert a scoped filter, owner, age, severity, and safe next action.
3. **Simplify the shell.** Use one mobile navigation model and add the missing organizer event index.
4. **Improve decision support.** Add system health, cash liability, event performance, and trend context without adding more decorative cards.

## Findings requiring Luna implementation

### P0 — Admin organizer actions do not validate the target role

`approveOrganizerAction` and `rejectOrganizerAction` load a user by ID and update `approvedAt`, but do not require `users.role = 'organizer'` before writing (`app/admin/actions/users.ts`, around lines 192–257). The UI only renders those forms for organizers, but a crafted server-action request can pass another user ID. The action can therefore approve or unapprove an attendee or vendor.

**Fix:** add a role predicate to the read and update, reject when the target is not an organizer, and use a compare-and-set condition for the expected current state. Record actor, target, old state, new state, reason, and request ID in an admin audit record. The same target validation pattern should be shared by freeze, unfreeze, role changes, verification, payout actions, and event moderation.

**Acceptance:** attempts against attendee, vendor, and admin IDs fail without mutation; repeated approval is idempotent; the audit log identifies the admin and state transition.

### P0 — Admin analytics bypasses the canonical revenue ledger

`app/admin/analytics/page.tsx` sums `orders.totalAmount` for `paid` and `completed` orders and labels the result USD. Its category, organizer, city, payment-method, and revenue-over-time queries repeat the same raw sum. This bypasses `lib/revenue-summary.ts`, which prorates issued ticket items, excludes direct and complimentary sales from organizer liabilities, applies the event fee, and accounts for paid/pending payouts and clawbacks.

The page also says “all currencies normalised to USD” without performing a conversion. Ticket quantities are taken from `order_items.quantity`, so a paid order with missing or failed ticket delivery can inflate “tickets sold.”

**Fix:** define one analytics read model with explicit measures: gross confirmed ticket value, platform fee, organizer net, issued tickets, direct/complimentary volume, refunds, and payout liability. Reuse the canonical status/payment-method rules and either restrict the UI to USD or add a dated exchange-rate table. Make every chart and breakdown consume the same typed result.

**Acceptance:** admin analytics matches organizer payout summaries and reconciliation for the same event/date range; direct and complimentary orders are visible as separate non-revenue volumes; multi-currency data cannot be shown as USD without a conversion record.

### P1 — Payout queue understates in-progress liability

The admin overview counts only `payouts.status = 'pending'` (`app/admin/page.tsx`, around lines 158–163). The canonical revenue helper treats `pending`, `approved`, and `processing` as active payout states (`lib/revenue-summary.ts`). Approved or processing payouts therefore disappear from the admin KPI and operations queue while still reducing organizer availability.

**Fix:** use one `ACTIVE_PAYOUT_STATUSES` query in the overview, payout page, reconciliation report, and API response. Show request count, gross amount, oldest age, and status breakdown.

**Acceptance:** a payout moves through pending → approved → processing without disappearing from the queue or changing the displayed liability unexpectedly.

### P1 — Review queue count, rows, and destinations can disagree

The admin overview adds `draftEvents`, `pendingOrganizers`, and `unverifiedUsers` totals together (`app/admin/page.tsx`, around lines 113–149 and 246–249), but renders only five rows from each source. An unverified organizer can be counted in both organizer approval and email verification. `unverifiedUsers` has no role filter, so attendee verification is mixed into the organizer/event review queue. The “stale payment checks” card links to `status=awaiting_verification`, while the orders page’s combined pending filter is `status=pending`.

**Fix:** create a typed `admin_work_items` result with unique item IDs, kind, severity, age, scope, destination, and action. Count the same list that is paginated or expose an explicit “showing 5 of N.” Split identity verification, organizer approval, event moderation, payment exceptions, delivery failures, and payout review into separate queues.

**Acceptance:** every badge number is traceable to a filterable list; no item is double-counted; each card opens the exact state it describes; empty and stale states explain the next action.

### P1 — Mobile dashboards expose duplicate navigation and one dead link

The root layout renders `MobileNav` on all `/organizer` and `/payouts` routes. The organizer layout adds `OrganizerTopNav`, and event pages add `EventSidebar`; both also render mobile navigation. This creates stacked top navigation plus a fixed bottom bar on phones. `MobileNav` links to `/organizer/events`, but there is no `app/organizer/events/page.tsx`, so the tab is a 404 destination.

**Fix:** choose one mobile model. Recommended: keep a single fixed bottom organizer bar for Dashboard, Events, Orders, Scanner, and Payouts; use a compact event context bar inside event pages; hide the top-level mobile strip. Add `/organizer/events` as the paginated event index and make the desktop organizer nav point to it too.

**Acceptance:** every mobile tab resolves; only one persistent organizer navigation is visible; event context remains clear; browser back is not required for orientation.

### P1 — “Low check-in rate” is a false-positive alert

`lowCheckinEvent` is selected whenever a live event has any sold ticket and `checkedIn < sold` (`app/organizer/page.tsx`, around lines 354–364). That is true for nearly every event before doors open. The resulting value is a percentage, but the attention card treats it like an issue count.

**Fix:** define a real threshold and time window, for example: event is within 24 hours of start or currently live, sold ≥ 20, and check-in rate is below a configurable threshold. Label it “Check-in rate” and show `checked in / sold`, not only a percentage. Do not raise a warning before the event window.

**Acceptance:** a future event with zero check-ins does not warn; an event in progress below the threshold does; the card links to the correct live event.

### P1 — Organizer dashboard mixes ownership scope and caps the event set

The organizer dashboard loads at most 50 events (`app/organizer/page.tsx`, around lines 242–244), includes invited events in the event table, but uses `getOrganizerRevenueSummary(session.user.id)` for owner-only payout totals. A collaborator can therefore see attendance for invited events alongside earnings for owned events. The checklist also uses the first event in the mixed list as its target.

**Fix:** make scope explicit: “My events” (owned), “Shared with me” (invited), and “All accessible” only when requested. Payout KPIs must be owner scope; attendance KPIs must be labeled by scope. Add pagination or a server-side event index and select the checklist target from the owner’s first incomplete event.

**Acceptance:** an invited collaborator cannot mistake another organizer’s revenue for their own; no event disappears after the first 50; every CTA opens an event the user can act on.

### P1 — Operational alerts do not carry enough context for recovery

Organizer and admin cards expose counts for paid-without-tickets, delivery failures, duplicate ledgers, stale payments, and closed sales, but most links land on a broad orders or reconciliation page. The operator must repeat the diagnosis manually. Payment complaints are especially sensitive because “pending,” “awaiting verification,” “provider error,” and “paid but undelivered” require different actions.

**Fix:** standardize exception records with `kind`, `severity`, `orderId`, `eventId`, `createdAt`, `age`, `lastProviderState`, `deliveryState`, `safeAction`, and `blockedReason`. Add deep links and safe idempotent actions: recheck, resend, issue missing tickets, hold, or escalate. Never offer “complete” when provider settlement is unconfirmed.

**Acceptance:** a queue row answers what happened, how old it is, who owns it, and what action is safe without opening three pages.

### P2 — Stale and lifecycle rules are not consistently based on activity

Admin stale drafts use `events.createdAt < NOW() - 14 days` (`app/admin/page.tsx`), even though events have `updatedAt` (`db/schema.ts`). An organizer can actively edit a draft for 20 days and still be labelled stale. Organizer freeze is manually available on any no-event account, has no confirmation or reason input, and the freeze/unfreeze write is not attributed to an admin audit actor.

**Fix:** use `updatedAt` for inactivity, expose configurable thresholds, require a confirmation dialog and reason for freeze, and log the actor. Consider a grace period after approval and a reversible “contacted” state before freezing.

**Acceptance:** active drafts are not stale; freeze is blocked or clearly warned during the grace period; unfreeze restores access without changing approval; both transitions are auditable.

### P2 — Dashboard data loading is duplicated and difficult to observe

`app/admin/layout.tsx` runs three badge queries for every admin route, then individual pages authenticate and issue their own queries. The admin overview itself runs a large `Promise.all` of independent queries, while the organizer dashboard recomputes per-event and organizer-level revenue separately. There is no shared loader, query timing, snapshot timestamp, or stale-data indicator.

**Fix:** introduce server-side loaders (`getOrganizerDashboardData`, `getAdminOperationsData`) with typed return values and request-scoped caching. Add query timing logs and a “last refreshed” timestamp. Defer below-the-fold analytics and use bounded pagination for large lists.

**Acceptance:** route-level query counts are documented, slow queries are visible in logs, and the UI distinguishes fresh data from an unavailable provider or stale cache.

### P2 — Analytics charts need decision context

The revenue sparkline has no date labels, no zero-filled days, and no tooltip or accessible summary. The period selector has only 7/30/90 days, while the headline compares to the previous period without explaining the exact dates. Category, city, and payment mixes do not expose counts alongside percentages.

**Fix:** return a complete date series, add start/end labels, accessible table summaries, order/ticket counts, and explicit period text. Keep charts secondary to the KPI and exception queues.

## Target dashboard architecture

### Organizer dashboard

1. **Context header:** organizer name, selected scope, data freshness, “New event,” “Open scanner,” and “Request payout.”
2. **Financial strip:** gross confirmed ticket value, TicketPulse fee, net revenue, paid out, in progress, available balance. Add “owner scope” helper text.
3. **Action queue:** only actionable items, ordered by severity and age. Use the thresholded check-in rule and deep links.
4. **Event index:** searchable/paginated table or cards with status, date, capacity, issued tickets, check-ins, net revenue, and one primary action. Add an event switcher for event-level work.
5. **Performance:** net sales by event, recent orders, and check-in trend with date context.
6. **Communication and help:** attendee broadcasts, WhatsApp/email status, and support entry points grouped together rather than mixed with finance.

### Super Admin dashboard

1. **System health row:** Velocity API, webhook receipt, cron/recheck, OpenWA, email delivery, and database status with last successful check.
2. **Cash and liability row:** confirmed gross, platform fees, organizer net liability, paid out, active payout liability, clawbacks, and unreconciled provider amount.
3. **Operations inbox:** deduplicated typed work items for payment exceptions, delivery failures, payout review, event moderation, organizer approval, and review moderation.
4. **Lifecycle panels:** organizers without events, stalled drafts, frozen accounts, pending approvals, and contactability with age buckets and bulk-safe actions.
5. **Recent activity:** orders, provider transitions, admin actions, and moderation events with actor and timestamp.
6. **Drilldown links:** every KPI opens a filtered, paginated list using the same metric definition.

## Luna implementation slices

### Slice 1 — Contracts and canonical data

- Add shared types for `DashboardMetric`, `WorkItem`, `DashboardScope`, and `SystemHealthCheck`.
- Implement `getOrganizerDashboardData()` and `getAdminOperationsData()` with typed, scoped results.
- Reuse canonical revenue and payout status definitions; remove raw revenue sums from admin analytics.
- Add date-range and currency policy to the loader contract.

### Slice 2 — Navigation and event index

- Add `app/organizer/events/page.tsx` with search, status filters, pagination, and owner/shared scope.
- Remove the duplicate mobile strip; keep one bottom nav and a compact event context bar.
- Ensure desktop and mobile links share the same route map.

### Slice 3 — Organizer workflow

- Replace the false-positive check-in alert with the thresholded rule.
- Separate owned and invited event scopes.
- Put financial KPIs above the fold and make the payout request state explicit.
- Convert broad “Review orders” links to deep-linked exception filters.

### Slice 4 — Admin safety and operations inbox

- Guard every admin state mutation by target role/state.
- Add confirmation, pending state, idempotency, and audit attribution to approve/reject/freeze/unfreeze and payment recovery actions.
- Build the deduplicated work-item queue and align sidebar badges with it.
- Add active payout statuses and health checks to the overview.

### Slice 5 — Analytics and observability

- Rebuild analytics from the canonical read model.
- Add zero-filled date series, counts, accessible summaries, and exact date labels.
- Add loader timing, provider-health timestamps, and a stale-data state.

## Verification plan

### Data and security

- Unit test each revenue measure against paid, completed, refunded, direct, complimentary, partially delivered, and multi-currency orders.
- Test that organizer approval/rejection actions reject non-organizer IDs and stale state transitions.
- Test pending/approved/processing payout totals against the payout page and organizer available balance.
- Test deduplication when one user is both unverified and pending organizer approval.

### UI and workflow

- Playwright or equivalent checks at 390px, 768px, and 1280px for both dashboards.
- Confirm one mobile nav only, no horizontal clipping, keyboard focus for every action, and visible loading/error states.
- Verify every queue card’s count, destination, filter, and primary action against the same fixture.
- Verify `/organizer/events` is reachable from every organizer navigation surface.

### Operational acceptance

- Simulate a pending EcoCash order, paid-but-undelivered order, failed delivery, duplicate ledger, payout in processing, stalled organizer, and frozen organizer.
- Confirm the dashboard explains the state and offers only safe actions.
- Confirm a provider outage or stale database read is shown as unavailable/stale rather than as zero.

## Audit limits

This audit was source-led and read-only. It did not mutate production data, initiate a payment, or verify the currently deployed commit. The earlier organizer lifecycle audit and EcoCash/Velocity audits remain the source of production snapshots and provider findings; Luna should re-run the relevant read-only checks before shipping the dashboard changes.
