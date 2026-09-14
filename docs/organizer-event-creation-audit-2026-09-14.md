# Organiser event-creation audit — 14 September 2026

## Database snapshot

The audit reviewed organiser accounts and their event ownership in the production database on 14 September 2026:

- **20** organiser accounts
- **11** have never created an event
- **10** have been registered for at least 14 days without an event
- **8** have been registered for at least 30 days without an event
- **2** have been registered for at least 90 days without an event
- **10** have no phone number on their account
- **0** are pending approval
- **0** are waiting for email verification
- The **10 existing organiser events are all published**

The admin organiser module now exposes these counts, shows registration age beside each account, identifies the last event for active organisers, and provides `No event` and `Stalled 14d+` filters. Email follow-up actions open a prefilled onboarding message instead of requiring an admin to write it from scratch.

Following the audit, all **11** organisers with zero events were frozen on 14 September 2026. The freeze is stored separately from approval, carries the reason `Frozen by admin: no event created`, blocks organiser dashboard and event-management access, and can be reversed by an admin. No notification was sent as part of the freeze operation.

The admin overview now adds operational queue signals for stale payment checks, paid orders without tickets, duplicate ledgers, stale event drafts, ageing event reviews, frozen organisers, no-event organisers, payout requests, and customer reviews.

## Self-creation path review

There are two web event-creation paths:

1. The organiser form action at `app/organizer/events/new/actions.ts`.
2. `POST /api/events` for authenticated API clients.

Both paths call `requireApprovedOrganizer()`, which reads the current user from the database and requires:

- a signed-in session,
- the `organizer` role (or the explicit admin exception),
- a verified email address, and
- a non-null approval timestamp.

Both paths write `events.organizer_id` from the verified session identity rather than accepting an organiser ID from the request. Event edit, publish, delete, and event-management actions use owner access checks against that same field. The mobile organiser event endpoint is read-only; it does not expose a create operation.

## Remaining audit limitation

The `events` table records the owner (`organizer_id`) and timestamps, but it does not record a separate `created_by` actor or an event-creation audit log. Therefore an admin-created event is indistinguishable from an organiser-created event after the fact if both target the same owner. The current audit can prove ownership and access control, but not which human clicked Create. A future migration should add an event activity/audit table if that distinction is required for compliance or operational reporting.
