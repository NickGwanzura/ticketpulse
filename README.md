# TicketPulse Zimbabwe

Zimbabwe's premier event ticketing platform. Built with Next.js 16, Neon Postgres, Drizzle ORM, Auth.js v5.

## Tech Stack
- Framework: Next.js 16 (App Router)
- Database: Neon Postgres (serverless)
- ORM: Drizzle ORM
- Auth: Auth.js v5 (next-auth@beta)
- Styling: Tailwind CSS v4
- Email: Resend (React Email)
- Payments: PesePay (Ecocash, PayNow, card, Omari, USD)
- Storage: Cloudflare R2 (S3-compatible, presigned uploads)

## Tier 1 Features
- Event discovery with search, filter, categories
- Ticket purchasing with multi-tier pricing
- Merch shop: per-event store with sizes, colors, pickup and delivery
- Shuttle bookings: seat selection, operator ratings, departure points
- Vendor marketplace: caterers, bar, photographers book packages per event
- Photo gallery: post-event galleries with paid photo pack downloads
- Organiser dashboard: manage events, tiers, merch, galleries
- Admin panel: users, events, orders, analytics, payouts
- Guest checkout with email verification
- Google OAuth + magic-link sign-in / sign-up

## Setup

1. Copy `.env.example` to `.env.local` and fill in values
2. Get `DATABASE_URL` from [neon.tech](https://neon.tech)
3. Run: `npm run auth:secret`
4. Set up Google OAuth at [console.cloud.google.com](https://console.cloud.google.com)
5. Create Resend API key at [resend.com](https://resend.com)
6. Configure PesePay integration at [merchant.pesepay.com](https://merchant.pesepay.com)
7. Set up Cloudflare R2 bucket for media uploads
8. `npm run db:push`
9. `npm run dev`

## Scripts
| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run db:push` | Push schema to Neon |
| `npm run db:generate` | Generate migrations |
| `npm run db:migrate` | Apply migrations |
| `npm run db:studio` | Open Drizzle Studio |
| `npm run auth:secret` | Generate `AUTH_SECRET` |

## Environment Variables

See [`.env.example`](./.env.example) for all required variables organised by section:

- `DATABASE_URL` — Neon Postgres connection string
- `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` — NextAuth v5
- `AUTH_RESEND_KEY`, `ADMIN_EMAIL` — Resend transactional email
- `R2_*` — Cloudflare R2 credentials
- `PESEPAY_*` — PesePay integration keys
- `NEXT_PUBLIC_APP_URL` — Deployed app URL
- `LAUNCH_GATE_*` — Coming-soon access control

## Deployment

The app is designed to deploy on Railway. Ensure all environment variables from
`.env.example` are set in the Railway dashboard before starting the service.

## Flutter organizer app

The native Android/iOS organizer app lives in [`flutter_organizer/`](./flutter_organizer/README.md).
It includes sign-in, event operations, customer orders, QR check-in, and payout
status, using the shared backend. See its README for setup, API contracts, and
build verification. The Expo app in `mobile/` remains a separate project.
