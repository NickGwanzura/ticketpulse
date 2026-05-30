# TicketPulse — Complete UX/UI, IA, Workflow & Product Design Audit

**Audited by:** Principal Product Designer, Staff UX Designer, SaaS Product Architect, Event Operations Specialist, Senior Frontend Engineer  
**Date:** 2026-05-29  
**Scope:** Full platform — Admin, Organizer, Scanner, Attendee, Checkout, Payouts, Design System, Performance, Mobile

---

## Table of Contents

1. [UX Audit Findings](#1-ux-audit-findings)
2. [UI Audit Findings](#2-ui-audit-findings)
3. [Workflow Problems](#3-workflow-problems)
4. [Dashboard Architecture Redesign](#4-dashboard-architecture-redesign)
5. [New Navigation Structure](#5-new-navigation-structure)
6. [Mobile Improvements](#6-mobile-improvements)
7. [Order Recovery UX](#7-order-recovery-ux)
8. [Payment Recovery UX](#8-payment-recovery-ux)
9. [Ticket Delivery UX](#9-ticket-delivery-ux)
10. [Design System Specification](#10-design-system-specification)
11. [Component Refactor Plan](#11-component-refactor-plan)
12. [Screen-by-Screen Recommendations](#12-screen-by-screen-recommendations)
13. [Priority Ranking](#13-priority-ranking)

---

## 1. UX Audit Findings

### 1.1 Information Architecture — Confused

The platform has **three distinct dashboards** (Admin, Organizer, Attendee) with no clear hierarchy or wayfinding. Users who have multiple roles (common for small teams) must manually navigate between `/admin`, `/organizer`, and `/dashboard` with no unified entry point or role switcher.

**Critical Finding:** The `/dashboard` route is a dead end for non-admin/non-organizer users. It displays hardcoded zeros ("0 upcoming events", "0 tickets", "0 loyalty points") and immediately redirects after rendering, causing a flash of broken content. This is the primary post-login destination.

### 1.2 Mental Model Mismatch

The navigation models the **database schema**, not user mental models:

- **"Tickets" vs "Orders" pages** — Admins see both `/admin/tickets` and `/admin/orders`. The tickets page is ~60% duplicate code of orders. Users don't think "I need to see tickets" — they think "I need to see who bought what."
- **"Velocity" as a top-level nav item** — This is a payment processor, not a user workflow. It should be a filter inside Orders, not a standalone page.
- **14 sub-pages per event** — The event sidebar has 14 links (Overview, Details, Tickets, Questions, Gallery, Merch, Vendors, Live, Email, WhatsApp, Promos, Organisers, Staff, Attendees). No prioritization, no grouping, no indication of which have content.

### 1.3 Action Discoverability — Poor

**Orders table:** Up to 6 action buttons per row (Resend, Recheck, Complete, Send Tickets, Refund, Download). Actions are crammed into a dense column, causing horizontal overflow even at `min-w-[900px]`. On mobile, the same logic is duplicated inline.

**Events table:** 9 icon buttons per row (Manage, Publish, View, Edit, Tiers, Questions, Funnel, Gallery, Merch). Icon-only buttons have no tooltips. New admins will not know what each icon does.

**Scanner page:** Uses buyer's `useCart()` context for local validation before server lookup. This is architecturally wrong — the scanner validates against the organizer's cart context, not the event's ticket database.

### 1.4 Empty States — Good but Inconsistent

`EmptyState.tsx` is well-designed with dot-grid backgrounds and contextual CTAs. However:
- Not used on `/dashboard` (shows hardcoded zeros instead)
- Not used on `/admin/payouts` (shows empty table with stub data)
- Not used on `/admin/settings` (shows disabled form)

### 1.5 Feedback Loops — Weak

- **No confirmation for Refund** — One-click financial action with no confirmation dialog
- **No confirmation for Complete** — One-click order completion with no undo
- **No progress indication for AI generation** — AI buttons show no loading state beyond generic spinners
- **Toast notifications overlap** — Multiple action buttons in a row show toasts that can visually collide
- **No audit trail visible to users** — Actions are logged in `paymentLedger` but never surfaced in UI

### 1.6 Search & Discovery — Broken or Missing

| Page | Search | Filter | Pagination |
|------|--------|--------|------------|
| Admin Orders | ✅ (raw SQL `like`) | ✅ (status pills) | ❌ (hard limit 100) |
| Admin Events | ❌ | ✅ (client-side JS) | ❌ (hard limit 100) |
| Admin Users | ❌ (visual placeholder only) | ❌ (pills are decorative) | ❌ (hard limit 200) |
| Admin Tickets | ✅ | ✅ | ❌ (hard limit 200) |
| Organizer Events | ✅ | ✅ | ❌ (hard limit 50) |
| Organizer Orders | ✅ | ✅ | ❌ (hard limit 100) |
| Organizer Attendees | ❌ | ❌ | ❌ |

**Users page search input has no `name`, no form, no `onChange`.** It is a purely visual text box that does nothing.

### 1.7 Role Confusion

The same user can be `attendee`, `organizer`, `vendor`, and `admin`. But:
- No unified "Switch role" interface
- No indication of current role in the global navbar (except admin link in dropdown)
- Vendor dashboard is completely separate and minimal
- Organizer who is also an admin must remember two different URLs

---

## 2. UI Audit Findings

### 2.1 Visual Design — Premium but Fragile

**Strengths:**
- Custom animation system (`tp-fade-up`, `tp-lift`, `tp-shimmer`, `tp-reveal`)
- Three premium font families (Clash Display, General Sans, PolySans)
- Micro-interactions (lift-on-hover, press-on-active, glow rings)
- Skeleton loading with shimmer (not gray boxes)
- Consistent card aesthetic (`rounded-2xl`, `border-line`, `bg-paper`)

**Critical Weaknesses:**

**Color token naming is catastrophically wrong:** `--color-green` resolves to `#131132` (dark purple/indigo). `bg-green-600` renders as `#0D0B26` (near-black). This means every "green" button is actually dark purple. The semantic name "green" is used 47+ times in the codebase and will cause design handoff confusion and future bugs.

**Missing design tokens:** `blue`, `rose`, `amber`, `purple` are used extensively but NOT defined in `@theme`. They silently fall back to Tailwind defaults, which could shift in future versions.

### 2.2 Typography — Too Small

| Element | Current Size | Recommended |
|---------|-------------|-------------|
| Table body | 13px | 14px |
| Labels | 11px–11.5px | 12px |
| Card titles | 15px–16px | 16px–18px |
| Buttons | 13px–14px | 14px |
| Status badges | 10px–11px | 11px–12px |

At 11px, labels are barely legible on high-DPI screens. At 10px, badge text is below WCAG 2.1 AA thresholds.

### 2.3 Component Inconsistencies

| Component | Issue |
|-----------|-------|
| `StatCard` | Hardcodes `text-[26px] md:text-[28px]` instead of using `.tp-stat` utility |
| `EmptyState` | Inlines its own button styles instead of using `Button` component |
| `PageHeader` | Communications page doesn't use it — custom inline header instead |
| `Accordion` | Uses native `<details>` — no controlled mode for form validation |
| `Button` | `destructive` variant exists but is rarely used; destructive actions use `rose` inline styles instead |

### 2.4 Tables — Information Overload

Admin orders table has **12 columns** on desktop:
1. Order ID
2. Customer (name + email + phone)
3. Event
4. Method + Ref
5. Status badge
6. Payment badge
7. Fulfilment badge
8. Delivery badge
9. Date
10. Amount
11. Actions (up to 6 buttons)

This requires `min-w-[900px]` and horizontal scrolling. On mobile, the same data is crammed into stacked cards with duplicated action logic.

### 2.5 Dark Mode — Nonexistent

`html { color-scheme: light; }` is hardcoded. No `dark:` variants. The footer appears dark but is a static design choice. For a platform used at events (often at night), dark mode is a significant omission.

---

## 3. Workflow Problems

### 3.1 Order Management — Fragmented

An order passes through multiple statuses (`pending` → `awaiting_verification` → `paid` → `completed`). But the recovery workflows are scattered:

- **Stuck in `pending`?** Admin must find the order, click "Recheck", wait for polling, then possibly "Complete & Send"
- **Stuck in `awaiting_verification`?** Admin can "Resend" magic link or "Complete & Send" to bypass
- **Email failed?** Admin must notice the failed delivery badge, then click "Send Tickets"
- **Tickets missing?** Admin must click "Send Tickets" which regenerates and resends

**Problem:** There is no "Fix this order" wizard. Admins must know the internal state machine to pick the right action. The actions are all visible but provide no guidance on which to use when.

### 3.2 Event Creation — AI Tools Broken on New Event

The new event form passes empty strings to `AiSocialButton`, `AiPricingButton`, etc. because there is no event data yet. These buttons are rendered but non-functional. They should be hidden or disabled until minimum fields are filled.

### 3.3 Checkout — Cart/Checkout Split

Cart allows multi-event items. Checkout enforces single-event. User only learns this at checkout. No warning in cart.

### 3.4 Payouts — Completely Non-Functional

- `/payouts` (public marketing page) exists and is beautiful
- `/admin/payouts` is entirely stubbed — `const PAYOUTS: Payout[] = []`
- `/app/payouts/page.tsx` (user-facing) doesn't exist as a functional dashboard
- No payout schema in database
- No payout API endpoints
- "Process payouts" button is a no-op

### 3.5 Scanner — Wrong Data Source

```typescript
const order = ready ? getOrder(parsed.orderId) : null
```

This calls `useCart().getOrder()` — the **buyer's cart context**. A scanner operator's cart will not contain the tickets they're scanning. This only works if the scanner operator happens to have the same order in their cart. The fallback to server lookup (`markTicketScannedAction`) exists but the primary validation path is fundamentally broken.

### 3.6 Communications — No Safety Rails

- No recipient count preview before send
- No scheduling — immediate send only
- No message templates or history
- No validation that recipients have phone numbers for WhatsApp
- Sequential email loop — no batching, will timeout on large audiences

### 3.7 Settings — Demo Mode Only

`/admin/settings` has uncontrolled inputs, disabled save button, and footer text: "Demo settings, changes won't persist." The platform cannot be configured through UI.

---

## 4. Dashboard Architecture Redesign

### 4.1 Philosophy

**From:** Database-schema-driven navigation with dense data tables  
**To:** Workflow-driven dashboards that surface only what requires action

**Principles:**
1. **Today first** — What needs my attention right now?
2. **Trends second** — How is my business performing?
3. **Deep dive last** — Full lists and archives are one click away, not the default view
4. **One-click actions** — Every common action is a single click from the dashboard
5. **Progressive disclosure** — Advanced actions and raw data are available but not prominent

### 4.2 Admin Dashboard Redesign

#### TODAY (requires action)

| Card | Metric | Action |
|------|--------|--------|
| Revenue today | $X,XXX | — |
| Tickets sold today | XXX | — |
| Active events | X | View → |
| Pending payouts | $X,XXX | Process → |
| Failed payments | X orders | Review → |
| Ticket delivery failures | X orders | Fix → |
| Scan activity | X check-ins | Live view → |
| Orders awaiting verification | X orders | Verify → |

#### THIS WEEK (trends)

| Card | Content |
|------|---------|
| Revenue trend | 7-day sparkline with MoM % |
| Event performance | Top 3 events by revenue |
| Recent orders | Last 10 orders with status |
| Conversion rate | Funnel summary |

#### QUICK ACTIONS

- Create Event
- Verify Payment
- Complete Order
- Send Tickets
- Process Payout
- Invite Organizer
- Broadcast Message

#### REMOVED FROM DASHBOARD

- Full orders table (moved to `/admin/orders`)
- Full events table (moved to `/admin/events`)
- AI Brief (moved to `/admin/analytics`)
- Published events list with hardcoded zeros
- Pending review queue (moved to `/admin/review`)

### 4.3 Organizer Dashboard Redesign

#### AT A GLANCE

| Card | Metric |
|------|--------|
| Revenue (net) | $X,XXX |
| Tickets sold | XXX / YYY capacity |
| Tickets scanned | XXX |
| Conversion rate | X.X% |
| Available balance | $X,XXX |
| Pending payout | $X,XXX |

#### MY EVENTS

Event cards (not tables) showing:
- Banner image
- Event name + date
- Revenue + tickets sold + remaining capacity
- Quick actions: Share · View sales · Manage attendees · Edit

#### QUICK ACTIONS

- Request Payout
- Share Event
- Export Sales
- Manage Attendees
- Open Scanner
- Send Broadcast

#### REMOVED

- Raw revenue chart (moved to event detail)
- Recent orders table (moved to `/organizer/orders`)
- Hardcoded followers count
- Hardcoded upcoming payout
- Sales by event bar chart (redundant with event cards)

### 4.4 Attendee Dashboard Redesign

The current `/dashboard` for attendees is a placeholder with hardcoded zeros. It should be replaced with:

#### MY TICKETS
- Upcoming events with ticket cards
- QR code preview (tap to expand)
- Download tickets button
- Add to calendar

#### MY ORDERS
- Order history with status
- Re-download tickets
- Request refund (if within policy)

#### PROFILE
- Edit details
- Payment methods
- Notification preferences

---

## 5. New Navigation Structure

### 5.1 Global Navigation

```
[Logo]                    [Search ⌘K] [Notifications] [Avatar ▼]
                                          ├── Profile
                                          ├── My Tickets
                                          ├── My Orders
                                          ├── Switch to Organizer
                                          ├── Switch to Admin
                                          └── Sign Out
```

**Role Switcher:** Users with multiple roles see "Switch to [Role]" options. Current role is indicated by a badge on the avatar.

### 5.2 Admin Navigation

```
Dashboard           ← Today + Quick Actions
Orders              ← All orders with recovery tools
  └── Order detail  ← Audit trail + actions
Events              ← Event list + moderation
  └── Event detail  ← Overview + sales + attendees
Payouts             ← Payout center (new)
People              ← Users + organizers + invites
Analytics           ← Revenue + funnel + reports
Communications      ← Broadcasts + templates
Settings            ← Platform configuration
```

**Removed:** Velocity (merged into Orders), Tickets (merged into Orders)

### 5.3 Organizer Navigation

```
Dashboard           ← At-a-glance + My Events
Events              ← Event cards
  └── [Event]       ← Overview
  └── [Event] Sales ← Tickets + revenue
  └── [Event] Attendees ← CRM + check-in
  └── [Event] Promo Codes
  └── [Event] Communications
Orders              ← Order management
Scanner             ← Mobile-first gate scanner
Payouts             ← Balance + requests
Settings            ← Profile + payout methods
```

**Consolidated:** 14 sub-pages → 6 per event. Gallery, Merch, Vendors, Staff moved to "Event Setup" tab. WhatsApp and Email merged into "Communications."

### 5.4 Scanner Navigation

Mobile-first. No sidebar. Full-screen camera with floating stats bar.

```
┌─────────────────────────┐
│ [Camera feed]           │
│    ┌─────┐              │
│    │     │  ← reticle   │
│    └─────┘              │
│                         │
│ ┌─────────────────────┐ │
│ │ VALID ENTRY         │ │
│ │ John Doe · VIP      │ │
│ └─────────────────────┘ │
│                         │
│ [Stats bar] [Manual]    │
└─────────────────────────┘
```

---

## 6. Mobile Improvements

### 6.1 Critical Issues

| Issue | Location | Fix |
|-------|----------|-----|
| Tables overflow | All admin tables | Replace with card lists on mobile |
| Action buttons too small | Orders, Events | Minimum 44px touch targets |
| Scanner not full-screen | `/organizer/scan` | Full viewport camera with overlay |
| Sidebar unusable | Admin/Organizer | Bottom tab bar on mobile |
| Input zoom | All forms | Already fixed (16px font-size) |
| Horizontal scroll | Filter pills | Wrap or truncate |

### 6.2 Mobile-First Redesigns

**Admin Dashboard:**
- Single column stack
- KPI cards in 2-col grid
- Quick actions as a horizontal scroll strip
- "Requires attention" as a notification-style list

**Orders:**
- Card-based list (already exists but improve)
- Swipe actions: Swipe right to resend, swipe left to refund
- Tap to expand full order detail
- Floating action button for "Create order"

**Scanner:**
- Full-screen camera (no sidebar, no header)
- Large result banner (valid = green, duplicate = amber, invalid = red)
- Haptic-style visual feedback (screen flash + pulse)
- Stats as floating pill at bottom

**Organizer Dashboard:**
- Event cards in single column
- Large CTA buttons
- Bottom navigation: Dashboard · Events · Orders · Scanner · More

### 6.3 Responsive Table Strategy

**Desktop (>1024px):** Full table with all columns  
**Tablet (768–1024px):** Table with hidden secondary columns, expandable rows  
**Mobile (<768px):** Card list with summary + tap-to-expand detail

---

## 7. Order Recovery UX

### 7.1 Current State

Order recovery requires admins to understand the internal state machine:
- `pending` → click "Recheck" or "Complete & Send"
- `awaiting_verification` → click "Resend" or "Complete & Send"
- `paid` with delivery failure → click "Send Tickets" or "Resend Tickets"

### 7.2 Proposed: Smart Recovery Panel

Each order gets a unified "Recovery" panel that:

1. **Diagnoses the problem automatically**
   - "Payment pending for 2 hours — Velocity may need rechecking"
   - "Buyer hasn't verified email — magic link sent 4 hours ago"
   - "Ticket email bounced — Resend recommended"
   - "Order is complete — no action needed"

2. **Suggests the single best action**
   - Primary button: "Recheck Payment" / "Resend Verification" / "Send Tickets"
   - Secondary button: "View Audit Trail"

3. **Shows audit trail**
   - Timeline: Order created → Payment initiated → Payment confirmed → Tickets generated → Email sent → Email delivered
   - Each step with timestamp and status

4. **Bulk recovery tools**
   - "Recheck all pending payments"
   - "Resend all failed deliveries"
   - "Complete all awaiting verification orders"

### 7.3 Order Detail Page Redesign

```
┌─────────────────────────────────────────┐
│ Order #TP-XXXXX          [Status Badge] │
├─────────────────────────────────────────┤
│ Customer: John Doe                      │
│ Event: Summer Festival                  │
│ Amount: $50.00 · EcoCash                │
├─────────────────────────────────────────┤
│ [RECOVERY PANEL]                        │
│ ⚠️ Payment pending for 2 hours          │
│ [Recheck Payment] [View Audit Trail]    │
├─────────────────────────────────────────┤
│ Tickets: 2x General Admission           │
│ QR: [preview] [Download] [Resend]       │
├─────────────────────────────────────────┤
│ Audit Trail                             │
│ • 14:32 — Order created                 │
│ • 14:33 — Payment initiated (Velocity)  │
│ • 14:33 — Awaiting confirmation...      │
└─────────────────────────────────────────┘
```

---

## 8. Payment Recovery UX

### 8.1 Current State

- Velocity polling every 15 seconds on admin page
- Manual "Recheck" button per order
- `reconcile-payments` cron runs periodically
- No visibility into retry attempts or failure reasons

### 8.2 Proposed: Payment Health Dashboard

**For Admin:**

```
┌─────────────────────────────────────────┐
│ Payment Health                          │
├─────────────────────────────────────────┤
│ 🟢 Healthy: 94% (47/50 today)           │
│ 🟡 Slow: 4% (2/50)                      │
│ 🔴 Failed: 2% (1/50)                    │
├─────────────────────────────────────────┤
│ [Auto-recovery ON]  Last check: 2m ago  │
├─────────────────────────────────────────┤
│ Needs Attention:                        │
│ • Order #TP-12345 — Pending 2h          │
│   [Recheck] [Mark Complete]             │
│ • Order #TP-12346 — Failed (insufficient│
│   funds) [Notify Buyer] [Refund]        │
└─────────────────────────────────────────┘
```

**For Organizer:**
- Simple view: "All payments healthy" or "2 payments need attention"
- No access to Velocity traces (too technical)
- Can mark cash-on-door payments as complete

### 8.3 Auto-Recovery Improvements

1. **Exponential backoff polling**
   - Instead of fixed 15s, use: 5s → 10s → 20s → 40s → 60s
   - Stop at 5 minutes, rely on cron

2. **Smart retry**
   - Don't retry `FAILED` (terminal) — surface to admin
   - Retry `UNKNOWN` up to 3 times
   - Retry network errors immediately

3. **Buyer notification**
   - If payment fails, auto-SMS/WhatsApp buyer with retry link
   - If payment succeeds but verification pending, remind after 1 hour

---

## 9. Ticket Delivery UX

### 9.1 Current State

- Tickets delivered via email (PDF attachment + QR codes)
- WhatsApp delivery as fallback (if phone provided)
- Delivery status tracked in `metadata.delivery` JSONB
- Failed deliveries show as badge in orders table

### 9.2 Proposed: Delivery Monitoring Center

**Dashboard for Admin:**

```
┌─────────────────────────────────────────┐
│ Ticket Delivery                         │
├─────────────────────────────────────────┤
│ Today: 47 delivered · 2 failed · 1 retry│
├─────────────────────────────────────────┤
│ Delivery Methods:                       │
│ ████████████ Email  89%                 │
│ ██ WhatsApp         8%                  │
│ ░ Pending           3%                  │
├─────────────────────────────────────────┤
│ Failed Deliveries:                      │
│ • Order #TP-12345 — Email bounced       │
│   [Resend Email] [Send WhatsApp]        │
│ • Order #TP-12346 — WhatsApp not found  │
│   [Resend Email] [Mark Manual]          │
└─────────────────────────────────────────┘
```

**For Buyer:**
- "Your tickets" page shows delivery status
- "Resend to email" button
- "Send to WhatsApp" button
- "Download PDF" always available
- "Add to Apple Wallet / Google Pay" (future)

### 9.3 Delivery Retry Queue

Instead of manual admin intervention:
1. Email fails → auto-queue WhatsApp retry
2. WhatsApp fails → auto-queue SMS retry (future)
3. All fail → flag for admin + notify buyer to check spam
4. Retry 3 times over 24 hours before giving up

---

## 10. Design System Specification

### 10.1 Color Tokens (Fixed)

```css
@theme {
  /* Backgrounds */
  --color-paper: #ffffff;
  --color-paper-2: #f6f9fc;
  --color-paper-3: #eef3f8;

  /* Text */
  --color-ink: #0a2540;
  --color-ink-2: #425466;
  --color-ink-3: #697386;

  /* Borders */
  --color-line: #e3e8ee;
  --color-line-2: #d0d9e2;

  /* Brand */
  --color-navy: #0a2540;
  --color-navy-700: #143d6b;
  --color-navy-600: #1a4f8c;

  /* Semantic — RENAMED from broken tokens */
  --color-brand: #131132;        /* was "green" — brand dark purple */
  --color-brand-50: #EEEDF3;
  --color-brand-100: #D4D3E2;
  --color-brand-500: #131132;
  --color-brand-600: #0D0B26;
  --color-brand-700: #09071A;

  /* Success */
  --color-success: #10B981;
  --color-success-50: #ECFDF5;
  --color-success-700: #047857;

  /* Warning */
  --color-warning: #F59E0B;
  --color-warning-50: #FFFBEB;
  --color-warning-700: #B45309;

  /* Error */
  --color-error: #EF4444;
  --color-error-50: #FEF2F2;
  --color-error-700: #B91C1C;

  /* Info */
  --color-info: #3B82F6;
  --color-info-50: #EFF6FF;
  --color-info-700: #1D4ED8;

  /* Explicitly define ALL used colors */
  --color-blue: #3B82F6;
  --color-rose: #F43F5E;
  --color-amber: #F59E0B;
  --color-purple: #8B5CF6;
}
```

### 10.2 Typography Scale

```css
/* Hero — 42px/64px */
.tp-heading-hero { font: 700 42px/1.05 var(--font-heading); letter-spacing: -0.03em; }
@media (md) { .tp-heading-hero { font-size: 64px; line-height: 1.02; } }

/* Section — 24px/32px */
.tp-heading-section { font: 600 24px/1.15 var(--font-heading); letter-spacing: -0.02em; }
@media (md) { .tp-heading-section { font-size: 32px; } }

/* Card — 18px/20px (increased from 20/22) */
.tp-heading-card { font: 500 18px/1.2 var(--font-heading); letter-spacing: -0.015em; }
@media (md) { .tp-heading-card { font-size: 20px; } }

/* Body — 15px/16px */
.tp-body { font: 400 15px/1.6 var(--font-body); }
@media (md) { .tp-body { font-size: 16px; } }

/* Label — 12px/13px (increased from 11/13) */
.tp-label { font: 500 12px/1.4 var(--font-body); letter-spacing: 0.01em; }
@media (md) { .tp-label { font-size: 13px; } }

/* Stat — 28px/32px (increased) */
.tp-stat { font: 700 28px/1.1 var(--font-body); letter-spacing: -0.02em; font-variant-numeric: tabular-nums; }
@media (md) { .tp-stat { font-size: 32px; } }

/* Badge — 11px/12px (increased from 10/11) */
.tp-badge { font: 600 11px/1 var(--font-body); letter-spacing: 0.02em; text-transform: uppercase; }
@media (md) { .tp-badge { font-size: 12px; } }
```

### 10.3 Spacing Scale (8px Grid)

```css
/* Use Tailwind's default scale but enforce consistency */
/* Cards: p-5 (20px) md:p-6 (24px) */
/* Card gap: gap-4 (16px) md:gap-5 (20px) */
/* Section gap: space-y-6 (24px) md:space-y-8 (32px) */
/* Page padding: px-5 (20px) md:px-8 (32px) */
```

### 10.4 Component Specs

**Button:**
```
Primary:   bg-brand-600 text-white shadow-sm hover:bg-brand-700
Secondary: border border-line bg-paper text-ink hover:border-line-2
Ghost:     text-ink-2 hover:text-ink hover:bg-paper-2
Destructive: bg-error text-white hover:bg-error-700
White:     bg-white text-navy shadow-sm hover:bg-paper-2

Sizes:
  sm: h-9  px-3.5 text-[13px]  rounded-lg
  md: h-11 px-4   text-[14px]  rounded-xl
  lg: h-12 px-5   text-[15px]  rounded-xl
  xl: h-14 px-6   text-[16px]  rounded-xl
```

**Card:**
```
Base: rounded-2xl border border-line bg-paper
Hover: tp-lift (translateY(-2px) + shadow)
Padding: p-5 md:p-6
```

**Badge:**
```
Success: bg-success-50 text-success-700 ring-1 ring-success-300/50
Warning: bg-warning-50 text-warning-700 ring-1 ring-warning-300/50
Error:   bg-error-50 text-error-700 ring-1 ring-error-300/50
Neutral: bg-paper-2 text-ink-2 ring-1 ring-line
Info:    bg-info-50 text-info-700 ring-1 ring-info-300/50

Shape: rounded-full px-2.5 py-1
Text: tp-badge (11–12px, uppercase, semibold)
```

**Table:**
```
Desktop: Full table, hover row highlight (tp-row-accent)
Mobile:  Card list with expand/collapse
Header:  text-ink-3, tp-label, uppercase
Cell:    tp-body text-ink
Row:     border-b border-line
```

**Modal/Drawer:**
```
Overlay: bg-ink/40 backdrop-blur-sm
Panel:   rounded-2xl bg-paper shadow-xl
Mobile:  Full-screen sheet (bottom-up)
Desktop: Centered modal or right-side drawer
```

### 10.5 Animation Tokens

```css
/* Entrance */
--transition-entrance: 380ms cubic-bezier(0.22, 0.61, 0.36, 1);
--transition-hover: 240ms cubic-bezier(0.16, 1, 0.3, 1);

/* Stagger delays */
--stagger-1: 60ms;
--stagger-2: 120ms;
--stagger-3: 180ms;
```

---

## 11. Component Refactor Plan

### 11.1 New Components to Create

| Component | Purpose | Location |
|-----------|---------|----------|
| `DataTable` | Unified responsive table (desktop table + mobile cards) | `components/data-table/` |
| `OrderCard` | Order summary card for mobile lists | `components/orders/OrderCard.tsx` |
| `OrderActions` | Smart action bar based on order status | `components/orders/OrderActions.tsx` |
| `RecoveryPanel` | Diagnosis + suggested action for stuck orders | `components/orders/RecoveryPanel.tsx` |
| `AuditTrail` | Timeline of order lifecycle events | `components/orders/AuditTrail.tsx` |
| `EventCardV2` | Premium event card with quick actions | `components/events/EventCardV2.tsx` |
| `KpiGrid` | Standardized stat card grid | `components/dashboard/KpiGrid.tsx` |
| `QuickActions` | Horizontal scroll action strip | `components/dashboard/QuickActions.tsx` |
| `MobileNav` | Bottom tab bar for mobile | `components/layout/MobileNav.tsx` |
| `CommandPalette` | ⌘K global search | `components/command-palette/` |
| `NotificationCenter` | Dropdown notification list | `components/notifications/` |
| `StatusBadge` | Unified status badge with icon + color | `components/ui/StatusBadge.tsx` |
| `ActionButton` | Wrapper for server actions with toast + confirm | `components/ui/ActionButton.tsx` |
| `ConfirmDialog` | Reusable confirmation modal | `components/ui/ConfirmDialog.tsx` |
| `DateRangePicker` | Period selector for analytics | `components/ui/DateRangePicker.tsx` |
| `EmptyState` | Already exists — enhance with `illustration` prop | `components/dashboard/EmptyState.tsx` |
| `ScannerView` | Full-screen scanner with result overlay | `components/scanner/ScannerView.tsx` |
| `PayoutCard` | Balance + request CTA | `components/payouts/PayoutCard.tsx` |
| `AttendeeRow` | Attendee list item with actions | `components/attendees/AttendeeRow.tsx` |

### 11.2 Components to Refactor

| Component | Changes |
|-----------|---------|
| `Button.tsx` | Rename `green` refs to `brand`; add `danger` alias for `destructive` |
| `StatCard.tsx` | Use `.tp-stat` utility; add `loading` state |
| `PageHeader.tsx` | Accept `backHref` prop for mobile back buttons |
| `EmptyState.tsx` | Use `Button` component; add `compact` variant for inline |
| `Sidebar.tsx` | Add mobile bottom nav variant; collapse to icons on tablet |
| `EventCard.tsx` | Add quick action hover overlay |
| `CheckoutSteps.tsx` | Larger touch targets on mobile; clearer active state |
| `TicketSelector.tsx` | Better sold-out state; clearer max-per-order messaging |
| `VelocityViewer.tsx` | Add backoff strategy; URL-synced filters |
| `AiBriefCard` | Show loading skeleton instead of empty |

### 11.3 Components to Remove / Merge

| Component | Reason |
|-----------|--------|
| `ResendButton`, `RecheckButton`, etc. | Replace with unified `ActionButton` |
| Admin `orders/page.tsx` + `tickets/page.tsx` | Merge into single orders view with ticket detail expand |
| Duplicate badge style definitions | Consolidate into `StatusBadge` |
| Duplicate mobile/desktop rendering | Use `DataTable` unified component |

### 11.4 File Structure Reorganization

```
components/
├── ui/                    # Primitives (Button, Input, Badge, Modal)
├── dashboard/             # Dashboard-specific (KpiGrid, QuickActions, PageHeader)
├── data-table/            # Unified table system
├── orders/                # Order management components
├── events/                # Event cards and management
├── scanner/               # Scanner-specific components
├── payouts/               # Payout components
├── attendees/             # Attendee CRM components
├── communications/        # Broadcast and messaging
├── layout/                # Navbar, Sidebar, Footer, MobileNav
├── command-palette/       # Global search
└── notifications/         # Notification center
```

---

## 12. Screen-by-Screen Recommendations

### 12.1 Admin Dashboard (`/admin`)

**Current:** 10+ queries, fake sparklines, hardcoded zeros, dense information  
**Target:** Action-oriented dashboard

**Changes:**
- Replace full tables with "needs attention" cards
- Add real sparklines from 7-day query
- Add "Quick Actions" horizontal strip
- Remove AI Brief (move to analytics)
- Add notification center for platform alerts
- Add "Today's Numbers" strip: Revenue, Tickets, Active Events, Issues

### 12.2 Admin Orders (`/admin/orders`)

**Current:** 12-column table, 6 action buttons per row, no pagination  
**Target:** Recovery-focused order management

**Changes:**
- Default view: "Needs Attention" (pending + failed + awaiting)
- Smart columns: Order #, Customer, Event, Amount, Status, Primary Action
- Expand row for full detail + audit trail
- Bulk actions: select multiple → recheck / complete / send tickets
- Pagination: 25 per page with cursor
- Mobile: Card list with swipe actions

### 12.3 Admin Events (`/admin/events`)

**Current:** 9 icon buttons per row, no search, client-side filtering  
**Target:** Moderation-focused event list

**Changes:**
- Add search (event name, organizer, city)
- Reduce actions to 3: View · Moderate (publish/unpublish) · Edit
- Move other actions into row expand or event detail
- Server-side filtering
- Pagination

### 12.4 Admin Payouts (`/admin/payouts`)

**Current:** Entirely stubbed, no data  
**Target:** Payout processing center

**Changes:**
- Build actual payout schema and API
- "Ready to Send" banner with total + Process button
- Table: Organizer, Method, Amount, Status, Actions
- Bulk process: select multiple → mark paid
- Export to CSV

### 12.5 Admin Users (`/admin/users`)

**Current:** Non-functional search, decorative filters, hard limit 200  
**Target:** People management

**Changes:**
- Fix search (full-text on name/email)
- Fix filters (URL-driven, server-side)
- Add user detail drawer (click row → slide-out with full profile)
- Add "Invite" button with template emails
- Pagination

### 12.6 Admin Settings (`/admin/settings`)

**Current:** Demo only, all inputs disabled  
**Target:** Functional platform configuration

**Changes:**
- Store settings in database (new `platform_settings` table)
- Sections: General, Payments, Email, Notifications, Integrations
- Real toggle switches with state
- Validation and save feedback
- Audit log of setting changes

### 12.7 Organizer Dashboard (`/organizer`)

**Current:** Dense grid, hardcoded financials, no pagination  
**Target:** Premium command center

**Changes:**
- KPI strip: Revenue (all currencies), Tickets Sold, Scanned, Conversion
- Event cards (not table) with revenue + capacity + quick actions
- "Recent Activity" feed (purchases, check-ins, messages)
- "Upcoming Events" priority list
- Remove hardcoded followers/payout

### 12.8 Organizer Event Detail (`/organizer/events/[id]`)

**Current:** 14 sub-pages in sidebar, overwhelming  
**Target:** Consolidated event management

**Changes:**
- Tabs: Overview · Sales · Attendees · Setup · Communications
- Overview: KPIs + recent activity + quick links
- Sales: Revenue chart + orders + ticket tiers
- Attendees: CRM table + check-in tools
- Setup: Details + Tiers + Promo + Gallery + Merch + Vendors + Staff
- Communications: Email + WhatsApp broadcasts

### 12.9 Organizer Scanner (`/organizer/scan`)

**Current:** Uses buyer cart context, not full-screen  
**Target:** Mobile-first gate scanner

**Changes:**
- Full-screen camera on mobile
- Large result overlay (valid/duplicate/invalid)
- Screen flash on scan (haptic visual feedback)
- Event selector dropdown (scan specific event)
- Server-first validation (remove cart context dependency)
- Offline queue with sync indicator

### 12.10 Organizer Orders (`/organizer/orders`)

**Current:** Similar to admin but fewer actions, 100-row limit  
**Target:** Organizer-focused order view

**Changes:**
- Scoped to organizer's events only
- Simpler actions: View, Resend, Complete
- No Velocity traces (too technical)
- Mobile card list

### 12.11 Checkout (`/checkout`)

**Current:** Multi-step form, polling overlay  
**Target:** Frictionless purchase

**Changes:**
- Clearer payment method selection (larger cards)
- Better "Check your phone" state for EcoCash
- Progress indicator during polling
- Clear error states with retry options
- Guest checkout vs account creation clearer

### 12.12 Order Success (`/checkout/success`)

**Current:** Confetti, ticket display  
**Target:** Delightful confirmation

**Changes:**
- Larger QR code preview
- One-tap "Add to Calendar"
- One-tap "Share"
- "View my tickets" prominent CTA
- "Download PDF" always available

### 12.13 Attendee Orders (`/orders`)

**Current:** localStorage primary, server fallback  
**Target:** Reliable ticket access

**Changes:**
- Server-first fetching (not localStorage)
- Ticket cards with QR preview
- Download all tickets as PDF
- Resend email button
- Order status tracking

---

## 13. Priority Ranking

### P0 — Critical (Fix Immediately)

| # | Issue | Impact | Effort |
|---|-------|--------|--------|
| 1 | **Scanner uses buyer cart context** | Security/functional failure | Medium |
| 2 | **Payouts page is entirely stubbed** | Core feature missing | High |
| 3 | **Settings page is non-functional** | Platform unconfigurable | Medium |
| 4 | **No confirmation for Refund action** | Financial risk | Low |
| 5 | **Users search/filter don't work** | Broken UX at scale | Low |
| 6 | **Dashboard hardcoded zeros + redirect flash** | Broken first impression | Low |
| 7 | **Color token `green` = purple** | Design system confusion | Low |

### P1 — High (Next Sprint)

| # | Issue | Impact | Effort |
|---|-------|--------|--------|
| 8 | **No pagination anywhere** | Won't scale | Medium |
| 9 | **Duplicate orders/tickets pages** | Maintenance burden | Medium |
| 10 | **Massive server actions file (1077 lines)** | Code quality | Medium |
| 11 | **KPI sparklines/deltas are fake** | Misleading analytics | Medium |
| 12 | **Mobile table overflow everywhere** | Mobile unusable | Medium |
| 13 | **Event actions column overloaded (9 icons)** | UX clutter | Low |
| 14 | **No real-time for live dashboard** | 5s polling is inefficient | High |
| 15 | **USD-only revenue aggregation** | Incorrect for multi-currency | Medium |

### P2 — Medium (Following Sprints)

| # | Issue | Impact | Effort |
|---|-------|--------|--------|
| 16 | **No command palette / global search** | Power user friction | High |
| 17 | **No notification center** | Missed alerts | Medium |
| 18 | **No audit trail visible in UI** | Debugging difficulty | Medium |
| 19 | **Communications no recipient count** | Risk of accidental blast | Low |
| 20 | **No dark mode** | Event operation at night | High |
| 21 | **No server-side cart** | Cross-device issues | High |
| 22 | **Client-side PDF generation** | Heavy, fragile on mobile | Medium |
| 23 | **No bulk actions on orders** | Operational inefficiency | Medium |
| 24 | **AI buttons broken on new event** | Feature non-functional | Low |

### P3 — Low (Nice to Have)

| # | Issue | Impact | Effort |
|---|-------|--------|--------|
| 25 | **No message templates** | Repeated typing | Low |
| 26 | **No scheduling for communications** | Operational rigidity | Medium |
| 27 | **No drag-and-drop tier reordering** | Minor UX improvement | Low |
| 28 | **No Apple Wallet / Google Pay** | Modern ticket delivery | High |
| 29 | **No calendar integration for organizers** | Scheduling convenience | Medium |
| 30 | **Footer newsletter is disabled** | Marketing gap | Low |

---

## Appendix A: Performance Audit

### Current Issues

1. **Admin dashboard runs 10+ sequential DB queries** — should parallelize with `Promise.all`
2. **No pagination** — loads 100–500 rows per page
3. **Polling every 15 seconds** — Velocity viewer is aggressive
4. **Client-side PDF generation** — `html2canvas` + `jspdf` is heavy
5. **No API abstraction** — Server Components query DB directly
6. **Large server actions file** — 1077 lines, loaded on every admin interaction

### Recommendations

1. **Parallelize queries** in all dashboard pages
2. **Add pagination** (cursor-based for orders, offset for smaller lists)
3. **Implement exponential backoff** for polling
4. **Move PDF generation server-side** (use `@react-pdf/renderer` or API route)
5. **Add React Query / SWR** for client-side data fetching with caching
6. **Split server actions** by domain (events.ts, orders.ts, users.ts, etc.)
7. **Add `revalidatePath` granularity** — don't revalidate `/admin` on every action
8. **Image optimization** — ensure all event images use `next/image` with proper sizes

### Target Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Dashboard load | ~3–5s | < 2s |
| Orders page load | ~2–3s | < 1.5s |
| Event list load | ~2s | < 1s |
| Scanner first scan | ~1s | < 500ms |
| Checkout complete | ~10–30s | < 15s |

---

## Appendix B: Accessibility Audit

### Current Strengths

- Custom focus rings with `box-shadow` (border-radius friendly)
- `prefers-reduced-motion` respected globally
- `aria-hidden` on decorative elements
- `scroll-padding-top` for sticky header
- Minimum 44px touch targets enforced

### Issues

1. **Icon-only buttons have no tooltips or `aria-label`** — Admin events table has 9 icon buttons with no accessible names
2. **Status badges use color alone** — No text alternative for colorblind users
3. **Tables lack proper `scope` attributes**
4. **Toast notifications not announced** — No `aria-live` region
5. **Modal/dialogs use custom implementation** — No focus trap, no Escape key handling (except invite dialog)
6. **AI tone selector uses emoji** — Not accessible (`😊`, `📋`, `⚡`)
7. **Scanner result uses color alone** — Valid/duplicate/unknown differentiated only by border color

### Recommendations

1. Add `aria-label` to all icon buttons
2. Add text + icon to all status badges
3. Implement proper focus trap for modals
4. Add `aria-live="polite"` region for toasts
5. Replace emoji tone selector with text labels
6. Add `role="status"` + `aria-label` to scanner result cards

---

*End of Audit Report*
