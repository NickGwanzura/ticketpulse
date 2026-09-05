# TicketPulse Organizer · Flutter

A separate Android/iOS organizer app. The Next.js website, existing Expo `mobile/`
app, and root Android project remain independent.

## Run

Use Flutter stable 3.47.2 (Dart 3.13.2) or a compatible newer version.

```sh
cd flutter_organizer
flutter pub get
flutter run --dart-define=API_BASE_URL=https://ticketpulse.tech
```

`API_BASE_URL` must be an HTTPS origin without a path, credentials, query, or
fragment. For local development, expose your local Next.js server through an
HTTPS development tunnel and pass that origin. Tokens are stored under a separate
secure-storage key per origin. Never put a backend secret in Dart defines.

Deploy the backend changes in this branch before using the new orders, payments,
and scanner screens against a remote server. No database migration is needed.
Use an existing organizer/admin account with an email and password. Account setup,
password recovery, event editing, and payout requests open the website; browser
sign-in is separate from the native session.

## Implemented

- Email/password sign-in, Keychain/Android secure storage, session restoration,
  shared token refresh for concurrent expired requests, and sign-out.
- Dashboard: managed events, sold ticket totals, check-in totals, and scan shortcut.
- Events: owned/invited events, status, date, venue, capacity, and scan actions.
  Admins see all events, consistent with the existing organizer API.
- Sales/orders: organizer-scoped customer orders, status filters, payment method,
  currency-preserving amounts, and pagination.
- QR camera and manual ticket/verification-link entry with a required live event.
  New, duplicate, invalid, and unconfirmed network outcomes are distinct. Each
  result requires an explicit “Check another ticket” action before scanning again.
  The app performs no offline admission or queued scan replay.
- Payments: canonical revenue/fees/net/available figures, payout progress and
  history. Finances always belong to the signed-in user, even for admins; invited
  event revenue is not added to the user's personal payout balance.
- Loading, retry, empty states, pull-to-refresh, system light/dark themes, and
  scrolling layouts for large text and landscape.

## Backend contracts

All amounts are decimal currency units, not cents. Dates are ISO 8601 and shown
in the device's local time. Organizer reads are private and not cached.

| Method | Path | Contract |
| --- | --- | --- |
| POST | `/api/mobile/auth/login` | `{email,password}` → `{ok,user,accessToken,refreshToken}` |
| POST | `/api/mobile/auth/refresh` | `{refreshToken}` → `{ok,accessToken,refreshToken}` |
| GET | `/api/mobile/me` | Bearer token → `{ok,user}` |
| GET | `/api/mobile/organizer/events` | Bearer token → `{ok,events:[{id,title,status,startsAt,venue,city,totalSold,totalCapacity,checkedIn}]}` |
| GET | `/api/mobile/organizer/orders` | `limit` 1–100 (default 25), `offset` ≥0, optional `status` → `{ok,orders,hasMore}` |
| GET | `/api/mobile/organizer/payments` | `{ok,currency,summary,payouts,hasMore}`; latest 100 payouts |
| POST | `/api/mobile/organizer/scan` | `{code,eventId}` → `{ok:true,status:new\|duplicate,ticket}` or `{ok:false,error}` |

Organizer routes verify bearer tokens and re-read the user's current role. Event
reads/orders use owner or invited-organizer membership (admins may view all).
Scanning checks membership before looking up a ticket and again against its actual
event. The shared ticket service retains paid-order, event state, duplicate, and
atomic check-in rules. Its default web-session authorization remains unchanged.
The original buyer `/api/mobile/orders` and cookie `/api/mobile/scan` contracts
are unchanged. Payout summaries reuse `lib/revenue-summary.ts` and the web app's
existing USD settlement policy; they are not recomputed from a page of orders.

## Verification

```sh
flutter analyze
flutter test
flutter build apk --debug --dart-define=API_BASE_URL=https://your-backend.example
flutter build ios --no-codesign --dart-define=API_BASE_URL=https://your-backend.example
```

From the repository root:

```sh
npm exec vitest run test/api/mobile
npm exec tsc -- --noEmit --incremental false
```

Tests cover secure-session lifecycle, expired-token concurrency, offline restore,
rejected scans, role revocation, owner/invited/outsider access, pagination bounds,
payout identity, and small-phone/landscape layouts with large text.

Android has network/camera permissions, optional camera hardware, and disabled
backups for stored tokens. iOS has a camera-use description and Keychain
entitlements. Full Xcode is required for iOS compilation. Release signing,
store metadata, and physical-device camera/secure-storage checks are still
required before distribution. The generated Android release configuration uses a
debug signing key for local development; configure production signing before a
store release.

Package setup follows the maintained [secure storage documentation](https://pub.dev/packages/flutter_secure_storage)
and [QR scanner documentation](https://pub.dev/packages/mobile_scanner).

## Visual design and brand assets

The UI follows the website's navy/burnt-orange palette and uses Manrope for
the premium app UI. The light and white logo SVGs come from
`public/ticketpulse-logo.svg` and `public/ticketpulse-logo-white.svg`; their paths
and colors are preserved, with presentation fill attributes for Flutter SVG
compatibility and empty canvas space trimmed. Native launcher icons use this logo.

Sample screen previews live in `docs/preview-*.png`. To regenerate them:

```sh
FLUTTER_ROOT=/path/to/flutter flutter test tool/capture_previews.dart --update-goldens
flutter test tool/generate_icons.dart
```

These preview tools use synthetic fixtures and do not access real accounts.
See [verification notes](docs/verification.md) for results and environment limits.
