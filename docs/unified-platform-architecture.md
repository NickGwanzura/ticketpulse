# TicketPulse Unified Platform Architecture

## Objective

TicketPulse remains one platform, one codebase, one payment engine, one QR engine, one reporting engine, and one user system.

The platform expands from event ticketing into a unified event, transport, manifest, revenue, payout, customer, and access-management system. Transport is not a second app. Transport is a first-class vertical inside TicketPulse.

## Current Baseline

TicketPulse already has the correct foundation:

- Event ticketing: `events`, `ticket_tiers`, `tickets`, `orders`, `order_items`.
- Shared checkout/payment flow: Velocity-backed checkout, payment ledger, order recovery, email/PDF delivery.
- Shared QR/access flow: ticket QR records, scanner action, used/duplicate validation.
- Shared payouts: `payouts`, `payout_audit_log`, organizer payout dashboard.
- Early transport primitives: `transport_operators`, `shuttle_routes`, `transport_bookings`, and `order_items.type = "transport"`.

The next step is to promote transport from event shuttles into a complete transport vertical while keeping it connected to the same order, payment, QR, payout, and reporting systems.

## Role System

### Target Roles

| Role | Purpose | Access |
| --- | --- | --- |
| `admin` | Super Admin | Full platform: events, transport, organizers, operators, orders, payments, revenue, payouts, routes, fleet, manifests, users, settings, audit logs. |
| `organizer` | Event Organizer | Events, attendees, ticket sales, scans, reports, payouts. No transport operator modules. |
| `transport_operator` | Transport Operator | Transport dashboard, routes, departures, fleet, bookings, passengers, manifests, reports, payouts. No event organizer modules. |
| `dispatcher` | Operations Dispatcher | Departures, fleet assignment, driver assignment, passenger manifests, boarding monitoring. No revenue. |
| `driver` | Assigned Driver | Mobile assigned trips, manifest, boarding status, route. No revenue. |
| `conductor` | Boarding Conductor | Mobile QR scanning, passenger validation, manifest, no-shows. No revenue. |
| `attendee` | Buyer / Passenger | Orders, tickets, booking lookup, transfers, reviews. |
| `vendor` | Vendor marketplace | Vendor profile, enquiries, bookings. |

### Required Auth Changes

Current `user_role` enum:

```sql
attendee, organizer, vendor, admin
```

Target additions:

```sql
transport_operator, dispatcher, driver, conductor
```

Use `admin` as the Super Admin role. Nicholas Gwanzura should remain an `admin`; no special hard-coded role is needed.

### Role Isolation Rules

- Event organizers must not see transport operator modules.
- Transport operators must not see event organizer modules.
- Dispatchers, drivers, and conductors must not see revenue.
- Shared pages like `/orders`, `/tickets`, and buyer self-service remain available to buyers regardless of event/transport product type.

Implement guards in `lib/access-control.ts`:

- `requireAdmin()`
- `requireOrganizerAccess(eventId)`
- `requireTransportOperatorAccess(operatorId)`
- `requireDispatcherAccess(operatorId | departureId)`
- `requireCrewTripAccess(departureId)`
- `canViewRevenue(user, scope)`
- `canScanAccess(user, ticketOrBooking)`

## Database Schema

### Existing Tables To Keep

Keep and evolve:

- `users`
- `orders`
- `order_items`
- `payment_ledger`
- `tickets`
- `payouts`
- `payout_audit_log`
- `transport_operators`
- `transport_bookings`

### Event Tables

No replacement needed:

- `events`
- `ticket_tiers`
- `tickets`
- `event_organisers`
- `ticket_questions`
- `ticket_question_responses`
- `reviews`

### Transport Tables

Current `shuttle_routes` is event-attached. Keep it short term for event shuttle compatibility, then migrate into the following canonical tables.

#### `transport_routes`

Stores reusable passenger routes.

Fields:

- `id`
- `operator_id`
- `name`
- `origin`
- `destination`
- `distance_km`
- `estimated_duration_minutes`
- `active`
- `created_at`
- `updated_at`

Indexes:

- `operator_id`
- `origin`
- `destination`

#### `transport_fleet`

Stores vehicles.

Fields:

- `id`
- `operator_id`
- `bus_number`
- `registration`
- `vehicle_type`
- `capacity`
- `status`: `active`, `maintenance`, `inactive`
- `metadata`
- `created_at`
- `updated_at`

Indexes:

- `operator_id`
- unique `(operator_id, registration)`

#### `transport_staff`

Maps dispatchers, drivers, and conductors to a transport operator.

Fields:

- `id`
- `operator_id`
- `user_id`
- `role`: `dispatcher`, `driver`, `conductor`
- `license_number`
- `phone`
- `active`
- `created_at`

Indexes:

- unique `(operator_id, user_id, role)`
- `user_id`
- `operator_id`

#### `transport_departures`

Stores scheduled trips.

Fields:

- `id`
- `operator_id`
- `route_id`
- `fleet_id`
- `driver_id`
- `conductor_id`
- `departure_date`
- `departure_time`
- `arrival_time`
- `capacity`
- `status`: `scheduled`, `boarding`, `departed`, `arrived`, `cancelled`
- `price`
- `currency`
- `created_at`
- `updated_at`

Indexes:

- `operator_id`
- `route_id`
- `fleet_id`
- `(departure_date, departure_time)`
- `status`

#### `transport_seats`

Optional generated seat inventory per departure.

Fields:

- `id`
- `departure_id`
- `seat_number`
- `status`: `available`, `reserved`, `booked`, `blocked`
- `booking_id`
- `created_at`

Indexes:

- unique `(departure_id, seat_number)`
- `booking_id`

#### `transport_bookings`

Evolve current table. Target fields:

- `id`
- `operator_id`
- `route_id`
- `departure_id`
- `user_id`
- `order_id`
- `passenger_name`
- `passenger_phone`
- `passenger_email`
- `id_number`
- `seat_number`
- `boarding_point`
- `ticket_reference`
- `qr_code`
- `payment_status`
- `boarding_status`: `not_boarded`, `boarded`, `no_show`, `cancelled`
- `boarded_at`
- `boarded_by`
- `status`
- `created_at`
- `updated_at`

Indexes:

- `operator_id`
- `route_id`
- `departure_id`
- `order_id`
- unique `(departure_id, seat_number)` where active
- unique `qr_code`

#### `transport_manifests`

Stores generated manifest snapshots.

Fields:

- `id`
- `operator_id`
- `departure_id`
- `generated_by`
- `version`
- `status`: `draft`, `locked`, `exported`
- `passenger_count`
- `boarded_count`
- `no_show_count`
- `pdf_url`
- `xlsx_url`
- `created_at`

Indexes:

- `departure_id`
- `operator_id`

#### `audit_logs`

Platform-wide audit trail.

Fields:

- `id`
- `actor_user_id`
- `actor_role`
- `scope_type`: `platform`, `event`, `transport_operator`, `departure`, `order`, `payout`
- `scope_id`
- `action`
- `before`
- `after`
- `metadata`
- `created_at`

## Orders

### Current State

`orders.event_id` is currently required. That makes transport-only orders awkward.

### Target State

Add:

- `orders.order_type`: `event`, `transport`, `mixed`
- `orders.event_id` nullable
- `orders.transport_operator_id` nullable
- `order_items.type`: keep existing text values but standardize to `ticket`, `merch`, `transport`, `photo`, `vendor`.

Transport-only bookings use:

- `orders.order_type = "transport"`
- `orders.transport_operator_id = operator`
- `order_items.transport_booking_id = booking`

Event tickets continue using:

- `orders.order_type = "event"`
- `orders.event_id = event`
- `order_items.tier_id = tier`

Mixed orders are allowed when a buyer purchases event tickets plus shuttle/transport.

## QR Engine

### Event QR

Keep current `tickets.qr_code` and scan actions.

### Transport QR

Use the same QR validation architecture with a different payload namespace:

- Event ticket payload: `tp:event-ticket:{ticketId}:{signature}`
- Transport boarding pass payload: `tp:transport-booking:{bookingId}:{signature}`

Create a canonical scanner resolver:

```ts
resolveQrPayload(qrCode) -> {
  productType: "event" | "transport",
  recordId: string,
  status: "valid" | "duplicate" | "invalid",
  display: ...
}
```

Event scanner and transport scanner should call this shared resolver.

## Payment Engine

Transport must use the existing Velocity/payment ledger flow.

Required work:

- Extend checkout cart item normalization for `transport`.
- Ensure Velocity metadata records `orderType`.
- Ensure `payment_ledger.event_id` can be null or add `transport_operator_id`.
- Add `payment_ledger.order_type`.
- Finalize workflow branches by `order_type`:
  - `event`: issue event tickets and PDFs.
  - `transport`: issue boarding passes, seat allocation, manifest updates.
  - `mixed`: run both fulfillment branches idempotently.

Supported payment methods:

- EcoCash
- Visa
- Mastercard through card processor capability
- ZIPIT when gateway/API support exists
- Bank transfer as manual/admin-verified payment, not automatic unless a provider is integrated

## Payout Engine

Use the existing payout table and flow.

Required changes:

- Add `payouts.operator_id` nullable.
- Keep `payouts.event_id` nullable.
- Use one payout dashboard component with scoped balance calculators:
  - Event organizer balance by organizer/event.
  - Transport operator balance by operator/departure/route.
- Dispatcher/driver/conductor cannot access payout pages.

## Navigation

### Super Admin

Add admin navigation groups:

- Platform
  - Overview
  - Users
  - Settings
  - Audit Logs
- Money
  - Orders
  - Payments
  - Reconciliation
  - Revenue
  - Payouts
- Events
  - Events
  - Organizers
  - Reviews
- Transport
  - Operators
  - Routes
  - Departures
  - Fleet
  - Manifests

### Event Organizer

Keep event-only nav:

- Overview
- Events
- Attendees
- Orders
- Scans
- Reports
- Payouts

No transport links.

### Transport Operator

New `/transport/dashboard` dashboard:

- Overview
- Routes
- Departures
- Fleet
- Bookings
- Passengers
- Manifests
- Reports
- Payouts

No event links.

### Dispatcher

New `/dispatch` dashboard:

- Departures
- Fleet Assignment
- Driver Assignment
- Manifests
- Boarding Monitor

No revenue.

### Driver / Conductor

New `/crew` mobile dashboard:

- Assigned Trips
- Manifest
- Scan / Validate
- No-Shows
- Route

No revenue.

## Dashboards

### Transport Operator Overview

Cards:

- Revenue Today
- Passengers Today
- Occupancy Rate
- Active Departures
- Upcoming Trips

Tables:

- Today’s departures
- Recent bookings
- Route revenue
- Fleet status

### Dispatcher Dashboard

Cards:

- Departures Today
- Vehicles Assigned
- Drivers Assigned
- Boarding In Progress

Views:

- Fleet assignment
- Driver/conductor assignment
- Passenger manifest
- Boarding status

### Driver / Conductor Dashboard

Mobile-first:

- Next assigned trip
- Route
- Departure time
- Manifest count
- Boarded / remaining / no-shows
- Scan button
- Manual lookup

## API Changes

### Transport

- `GET /api/transport/routes`
- `POST /api/transport/routes`
- `GET /api/transport/fleet`
- `POST /api/transport/fleet`
- `GET /api/transport/departures`
- `POST /api/transport/departures`
- `GET /api/transport/departures/:id/seats`
- `POST /api/transport/bookings`
- `GET /api/transport/bookings/:id`
- `POST /api/transport/bookings/:id/resend`
- `GET /api/transport/manifests/:departureId`
- `POST /api/transport/manifests/:departureId/generate`
- `GET /api/transport/manifests/:departureId/export.pdf`
- `GET /api/transport/manifests/:departureId/export.xlsx`

### Shared

- `POST /api/scan/resolve`
- `POST /api/scan/validate`
- `GET /api/orders/:id/data`
- `POST /api/orders/:id/resend`
- `GET /api/reports/revenue`
- `GET /api/reports/reconciliation`

## UI Changes

### Seat Map

Build a reusable component:

`components/transport/SeatMap.tsx`

Requirements:

- Mobile-first.
- Shows available, selected, booked, blocked.
- Supports bus layouts by capacity.
- Emits selected seat numbers.
- Locks booked seats.

### Manifest View

Build:

`app/transport/departures/[id]/manifest/page.tsx`

Includes:

- Passenger table.
- Seat.
- Boarding point.
- Ticket reference.
- Boarding status.
- Export PDF.
- Export Excel.
- Real-time refresh.

### QR Boarding Pass

Use existing email/PDF delivery patterns.

Passenger receives:

- PDF boarding pass.
- Mobile QR.
- Booking confirmation email.

## Reporting

### Shared Reporting Engine

Create shared report primitives:

- Revenue by scope.
- Orders by type.
- Payment ledger reconciliation.
- Fulfillment success.
- Scan/boarding rate.

### Event Reports

- Revenue.
- Attendees.
- Ticket sales.
- Scan rate.

### Transport Reports

- Revenue by route.
- Revenue by departure.
- Revenue by bus.
- Revenue by driver.
- Occupancy.
- Passenger count.
- No-show rate.

## Production Readiness Review

### Must Be True Before Transport Launch

- Role enum and guards are deployed.
- Transport-only orders no longer require `event_id`.
- Transport bookings are finalized from the same payment workflow.
- QR validation resolves both event and transport records.
- Seat selection prevents double-booking transactionally.
- Manifest exports are available.
- Payout balance calculators are separated by event vs transport operator.
- Dispatcher/driver/conductor roles cannot access revenue.
- Admin audit logs record manual booking/payment/boarding changes.
- End-to-end tests cover:
  - transport booking checkout
  - payment callback/finalize
  - boarding pass generation
  - QR scan valid/duplicate/invalid
  - manifest export
  - payout calculation

## Implementation Plan

### Phase 1: Foundation

1. Add role enum values.
2. Add role-aware dashboard routing.
3. Add access guards.
4. Update navigation isolation.
5. Add architecture-safe admin transport menu placeholders.

### Phase 2: Canonical Transport Schema

1. Add `transport_routes`.
2. Add `transport_fleet`.
3. Add `transport_staff`.
4. Add `transport_departures`.
5. Add `transport_seats`.
6. Extend `transport_bookings`.
7. Add `transport_manifests`.
8. Add audit logs.

### Phase 3: Transport Operator Dashboard

1. `/transport/dashboard` overview.
2. Routes CRUD.
3. Fleet CRUD.
4. Departures CRUD.
5. Basic bookings/passenger table.

### Phase 4: Seat Selection and Booking

1. Reusable seat map.
2. Seat locking.
3. Transport cart item.
4. Checkout integration.
5. Transport booking confirmation.

### Phase 5: QR Boarding and Manifest

1. Shared QR resolver.
2. Boarding pass PDF/email.
3. Driver/conductor scan view.
4. Manifest view.
5. PDF/XLSX export.

### Phase 6: Reporting and Payouts

1. Transport revenue calculators.
2. Route/departure/fleet/driver reports.
3. Transport payout balances.
4. Admin reconciliation for mixed event/transport orders.

### Phase 7: Hardening

1. E2E tests.
2. Audit logging.
3. Rate limits.
4. Production monitoring.
5. Rollback plan.

## First Safe Code Slice

The first production-safe implementation slice should be:

1. Add new role enum values.
2. Add access-control helpers.
3. Add role-aware dashboard redirect.
4. Add empty but guarded `/transport/dashboard`, `/dispatch`, and `/crew` dashboards.
5. Add admin transport navigation placeholders.

This unlocks the product structure without touching checkout, ticket generation, payouts, or existing event flows.
