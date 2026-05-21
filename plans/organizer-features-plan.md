# Organiser Features — Architecture Plan

## Overview

Four new features for the TicketPulse organiser dashboard, based on user request **"ADD ALL"**.

| # | Feature | Route | DB Changes | Complexity |
|---|---------|-------|-----------|------------|
| 1 | **Live Event Dashboard** | `/organizer/events/[id]/live` | None (uses existing `tickets.scannedAt`) | Medium |
| 2 | **Bulk Email Attendees** | `/organizer/events/[id]/email` | None (uses existing `orders.guestEmail`) | Medium |
| 3 | **Discount / Promo Codes** | `/organizer/events/[id]/promos` | New `promo_codes` table + checkout integration | High |
| 4 | **Attendee List CSV Export** | `/organizer/events/[id]/attendees` | None (query-only) | Low |

---

## Feature 1: Live Event Dashboard

### Data Model
- **No new tables needed.** `tickets.scannedAt` already exists in [`db/schema.ts`](../db/schema.ts:176)
- Check-in count = `SELECT COUNT(*) FROM tickets WHERE event_id = ? AND scanned_at IS NOT NULL`
- Total sold = `SELECT SUM(sold_quantity) FROM ticket_tiers WHERE event_id = ?`
- Total capacity = `SELECT SUM(total_quantity) FROM ticket_tiers WHERE event_id = ?`
- Entry rate = Aggregate `scanned_at` by hour for a chart

### Scan Page Integration
- The scan page's [`recordCheckin`](../app/organizer/scan/page.tsx:98) currently only writes to `localStorage`
- **New server action** [`app/organizer/scan/actions.ts`](../app/organizer/scan/actions.ts) → `markTicketScannedAction(ticketCode: string)`:
  - Parses the ticket code, looks up the ticket in DB, sets `scannedAt = new Date()`
  - Called from `recordCheckin` for valid tickets via a fire-and-forget fetch
- This makes check-ins visible in the DB for the live dashboard

### Page Structure
**Server Component**: [`app/organizer/events/[id]/live/page.tsx`](../app/organizer/events/[id]/live/page.tsx)
- Fetches all stats in one server component using direct DB queries
- Returns three stat cards + a chart

```
┌──────────────────────────────────────────────┐
│  🟢 Live Dashboard  ·  "Summer Festival"     │
│                                                │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐       │
│  │ 245/400  │  │  187    │  │  76%    │       │
│  │ Checked  │  │ Tickets │  │ Capacity│       │
│  │   In     │  │  Sold   │  │  Filled  │      │
│  └─────────┘  └─────────┘  └─────────┘       │
│                                                │
│  ┌──────────────────────────────────────┐     │
│  │  Entry Rate (bar/line chart)         │     │
│  │  ██   ████  ██  ██████  ███         │     │
│  │  9AM  10AM  11AM 12PM  1PM  2PM     │     │
│  └──────────────────────────────────────┘     │
└──────────────────────────────────────────────┘
```

**Client Component**: [`app/organizer/events/[id]/live/LiveDashboardClient.tsx`](../app/organizer/events/[id]/live/LiveDashboardClient.tsx)
- Auto-refresh via `setInterval` (every 30 seconds) polling a lightweight API endpoint
- Animated number transitions for stat cards

### Component Tree
```
live/page.tsx (Server — fetches initial data)
└── LiveDashboardClient.tsx (Client — auto-refresh, animations)
    ├── StatCard ("Checked In")
    ├── StatCard ("Tickets Sold")
    ├── StatCard ("Capacity Filled")
    └── EntryRateChart.tsx (bar chart of check-ins by hour)
```

### Navigation
- Add **"Live dashboard"** link to the action links in [`edit/page.tsx`](../app/organizer/events/[id]/edit/page.tsx:45) (line ~57, next to Tickets / Gallery / Merch / Vendors)
- Add **"Live dashboard"** quick link card to [`organizer/page.tsx`](../app/organizer/page.tsx:608) quick links section

---

## Feature 2: Bulk Email Attendees

### Data Model
- **No new tables needed.** Attendee emails come from:
  ```sql
  SELECT DISTINCT guest_email, guest_name
  FROM orders
  WHERE event_id = ? AND status IN ('confirmed', 'paid')
    AND guest_email IS NOT NULL
  ```

### Page Structure
**Client Component**: [`app/organizer/events/[id]/email/page.tsx`](../app/organizer/events/[id]/email/page.tsx)
```
┌──────────────────────────────────────────────┐
│  ✉️ Email Attendees  ·  "Summer Festival"     │
│                                                │
│  ┌──────────────────────────────────────────┐ │
│  │  Subject:  [___________________________]  │ │
│  │                                           │ │
│  │  Message:                                 │ │
│  │  ┌────────────────────────────────────┐   │ │
│  │  │ Hi {name},                         │   │ │
│  │  │                                    │   │ │
│  │  │ Just a reminder that...            │   │ │
│  │  └────────────────────────────────────┘   │ │
│  │                                           │ │
│  │  Recipients: 142 confirmed buyers         │ │
│  │                                           │ │
│  │  [📨 Send to all]  [🧪 Send test to me]   │ │
│  └──────────────────────────────────────────┘ │
└──────────────────────────────────────────────┘
```

### Server Action
**New file**: [`app/organizer/events/[id]/email/actions.ts`](../app/organizer/events/[id]/email/actions.ts)
- `sendBulkEmailAction(eventId, subject, message)`:
  1. Verify ownership (same pattern as `requireEventOwnership` in [`tiers/actions.ts`](../app/organizer/events/[id]/tiers/actions.ts:12))
  2. Query orders for event with status `confirmed` or `paid`, get distinct emails
  3. Iterate with 500ms delay (same pattern as [`scripts/send-announcement.ts`](../scripts/send-announcement.ts:57))
  4. Use `sendEmail` from [`lib/email.ts`](../lib/email.ts:58) with a new template
  5. Return count of emails sent
- `sendTestEmailAction(eventId, subject, message)`:
  - Same but sends only to the current user's email address

### Email Template
**New template** in [`lib/email-templates.ts`](../lib/email-templates.ts:632) (add after `announcementEmail`):
- `eventEmailTemplate(opts: { eventTitle, recipientName, subject, message })` → `{ html, text }`
- Uses the same `layout()` function and `BRAND` constants as existing templates
- Supports `{name}` and `{event}` placeholder replacement in the message body

### Navigation
- Add **"Email attendees"** link to action links in [`edit/page.tsx`](../app/organizer/events/[id]/edit/page.tsx:45)

---

## Feature 3: Discount / Promo Codes

### Data Model
**New table** in [`db/schema.ts`](../db/schema.ts) (add after `tickets` table, before `orders`):

```typescript
export const promoCodeTypeEnum = pgEnum("promo_code_type", ["percent", "fixed"])

export const promoCodes = pgTable("promo_codes", {
  id: uuid("id").primaryKey().defaultRandom(),
  eventId: uuid("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
  code: text("code").notNull(),
  type: promoCodeTypeEnum("type").notNull(),
  value: decimal("value", { precision: 10, scale: 2 }).notNull(),
  maxUses: integer("max_uses").default(0),  // 0 = unlimited
  usedCount: integer("used_count").default(0),
  minPurchaseAmount: decimal("min_purchase_amount", { precision: 10, scale: 2 }).default("0"),
  expiresAt: timestamp("expires_at"),
  active: boolean("active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  uniqueIndex("promo_codes_code_event_idx").on(table.code, table.eventId),
])
```

**Migration**: `npx drizzle-kit generate` will create the new migration.

### Promo Code Management Page
**Server Component + Client**: [`app/organizer/events/[id]/promos/page.tsx`](../app/organizer/events/[id]/promos/page.tsx)

```
┌──────────────────────────────────────────────┐
│  🏷️ Promo Codes  ·  "Summer Festival"        │
│                                                │
│  [+ Create promo code]                        │
│                                                │
│  ┌──────────────────────────────────────────┐ │
│  │ SUMMER20  │ 20% off  │ 45/100 used  │ 🔴 │ │
│  │ EARLYBIRD │ $5 off   │ 12/50 used   │ 🔴 │ │
│  │ VIP10     │ 10% off  │ 3/unlimited  │ 🔴 │ │
│  └──────────────────────────────────────────┘ │
└──────────────────────────────────────────────┘
```

**Server action**: [`app/organizer/events/[id]/promos/actions.ts`](../app/organizer/events/[id]/promos/actions.ts)
- `createPromoCodeAction(eventId, formData)` — creates a new promo code
- `togglePromoCodeAction(promoId, active)` — activate/deactivate
- `deletePromoCodeAction(promoId)` — delete a promo code

### Checkout Integration

The checkout flow needs modifications in **two places**:

#### A. Client-side ([`app/checkout/page.tsx`](../app/checkout/page.tsx))

Add a promo code input in the order summary sidebar (after the subtotal, before the Place Order button):

```
  Subtotal · USD        $450.00
  Promo: SUMMER20   -$90.00  [Remove]
  ───────────────────────────────
  Total · USD          $360.00

  [________________] [Apply]
```

State additions:
- `promoCode: string` — the input text
- `appliedPromo: { code: string; type: "percent" | "fixed"; value: number } | null`
- `promoError: string | null`
- `promoLoading: boolean`

Flow:
1. User types code and clicks "Apply"
2. Client calls `POST /api/checkout/validate-promo` with `{ eventSlug, code }`
3. If valid → `appliedPromo` is set, total recalculates
4. If invalid → `promoError` is shown

#### B. Server-side — New API Route ([`app/api/checkout/validate-promo/route.ts`](../app/api/checkout/validate-promo/route.ts))

```typescript
// POST /api/checkout/validate-promo
// Body: { eventSlug: string, code: string }
// Response: { valid: boolean, type?: "percent" | "fixed", value?: number, error?: string }
```

Validation logic:
1. Look up promo code by `code` and `eventId` (resolved from slug)
2. Check `active === true`
3. Check `expiresAt` not passed
4. Check `usedCount < maxUses` (or maxUses === 0 for unlimited)
5. Return the discount info

#### C. Order Creation — Guest Checkout ([`app/api/checkout/guest/route.ts`](../app/api/checkout/guest/route.ts))

Accept optional `promoCode` field in the request body:
```typescript
const Body = z.object({
  eventSlug: z.string(),
  items: z.array(CartLineSchema),
  paymentMethod: z.string(),
  email: z.string().email(),
  name: z.string().min(1),
  phone: z.string().optional(),
  promoCode: z.string().optional(),  // NEW
})
```

After computing `total` (line 120-128), if `promoCode` is provided:
1. Validate it (same logic as validate-promo)
2. Apply discount: `if type === "percent": total -= total * (value / 100)`
3. Apply discount: `if type === "fixed": total -= value` (but not below 0)
4. Store promo info in `order.metadata` (JSON field already exists)
5. Increment `promoCodes.usedCount` in the same transaction

**Important**: The promo code must be validated and applied **server-side** to prevent price manipulation.

### Navigation
- Add **"Promo codes"** link to action links in [`edit/page.tsx`](../app/organizer/events/[id]/edit/page.tsx:45)

---

## Feature 4: Attendee List CSV Export

### Data Model
- **No new tables needed.** Query joins:
  ```sql
  SELECT
    o.guest_name, o.guest_email, o.guest_phone, o.status as order_status,
    oi.quantity, oi.unit_price, oi.total,
    tt.name as tier_name,
    t.status as ticket_status, t.scanned_at
  FROM orders o
  JOIN order_items oi ON oi.order_id = o.id
  JOIN ticket_tiers tt ON tt.id = oi.tier_id
  LEFT JOIN tickets t ON t.order_id = o.id AND t.tier_id = oi.tier_id
  WHERE o.event_id = ? AND o.status IN ('confirmed', 'paid')
  ORDER BY o.created_at DESC
  ```

### Page Structure
**Server Component**: [`app/organizer/events/[id]/attendees/page.tsx`](../app/organizer/events/[id]/attendees/page.tsx)

```
┌──────────────────────────────────────────────┐
│  👥 Attendees  ·  "Summer Festival"          │
│                                                │
│  Total buyers: 142  ·  Total tickets: 400     │
│  Checked in: 187/400                          │
│                                                │
│  [📥 Download CSV]                            │
│                                                │
│  ┌──────┬──────────┬────────┬──────┬────────┐ │
│  │ Name │  Email   │ Ticket │ Qty  │ Checked│ │
│  ├──────┼──────────┼────────┼──────┼────────┤ │
│  │ John │ j@...    │ VIP    │  2   │   ✅   │ │
│  │ Jane │ jane@... │ GA     │  1   │   ❌   │ │
│  └──────┴──────────┴────────┴──────┴────────┘ │
└──────────────────────────────────────────────┘
```

### CSV Export API Route
**New file**: [`app/api/events/[id]/attendees/export/route.ts`](../app/api/events/[id]/attendees/export/route.ts)
```typescript
// GET /api/events/[id]/attendees/export
// Response: CSV file download with headers:
// Name, Email, Phone, Ticket Type, Quantity, Unit Price, Total, Checked In
```

- Authenticates via session (organizer must own the event)
- Queries the join query above
- Returns `Content-Type: text/csv` with `Content-Disposition: attachment; filename="event-name-attendees.csv"`
- Uses streaming for large datasets

### Navigation
- Add **"Attendees"** link to action links in [`edit/page.tsx`](../app/organizer/events/[id]/edit/page.tsx:45)

---

## Navigation Changes Summary

### File: [`edit/page.tsx`](../app/organizer/events/[id]/edit/page.tsx)

Current action links (lines ~51-82):
```
[Tickets] [Photo gallery] [Merch] [Vendors] [View live]
```

New action links:
```
[Tickets] [Photo gallery] [Merch] [Vendors] [Live] [Email] [Promos] [Attendees] [View live]
```

### File: [`organizer/page.tsx`](../app/organizer/page.tsx)

Add a new quick link card for Live Dashboard in the quick links section (lines ~608-616):
```tsx
{ title: "Live dashboard", body: "Real-time check-in tracking and entry stats", href: `/organizer/events/${e.id}/live` }
```

This should ideally be per-event, so it goes in the events table action column or as a per-event quick link.

---

## Implementation Order

The features should be implemented in this order to minimize risk and dependencies:

| Step | Feature | Reason |
|------|---------|--------|
| 1 | **Promo Codes** (schema + management page) | DB migration needed; no dependencies |
| 2 | **Promo Codes** (checkout integration) | Depends on step 1 |
| 3 | **Live Dashboard** (scan action + page) | Adds value quickly; scan action also benefits CSV |
| 4 | **CSV Export** (API route + page) | Simple query; can use check-in data from step 3 |
| 5 | **Bulk Email** (page + server action) | Uses the same attendee query as CSV |
| 6 | **Navigation updates** (edit page + dashboard links) | Final step, ties everything together |

---

## DB Migration

One new migration needed for the `promo_codes` table:

```bash
cd ticketpulse && npx drizzle-kit generate
```

This will create `db/migrations/0004_promo_codes.sql`.

---

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Promo code price manipulation | Validate + apply discounts **server-side only**, never trust client-side total |
| Bulk email deliverability | Use Resend's existing infrastructure; 500ms delay between sends; cap at 500/batch |
| Large CSV export memory | Stream CSV rows; use `ReadableStream` if dataset exceeds memory |
| Live dashboard stale data | Auto-refresh every 30s; initial data from server component (SSR) |
| Check-in duplication | Already handled by `lastSeenRef` debounce (1500ms) in scan page |
