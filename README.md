# TicketPulse Zimbabwe

Zimbabwe's premier event ticketing platform. Built with Next.js 16, PostgreSQL, Drizzle ORM, Auth.js v5.

## Tech Stack
- Framework: Next.js 16 (App Router)
- Database: PostgreSQL (hosted on Dokploy)
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
2. Set `DATABASE_URL` to a PostgreSQL connection string. For local development use a local
   database (e.g. `postgresql://<user>@localhost:5432/ticketpulse`); the production database
   lives on Dokploy (see [Deployment](#deployment)) and should not be used for local work
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
| `npm run db:push` | Push schema to the database in `DATABASE_URL` |
| `npm run db:generate` | Generate migrations |
| `npm run db:migrate` | Apply migrations |
| `npm run db:studio` | Open Drizzle Studio |
| `npm run auth:secret` | Generate `AUTH_SECRET` |

## Environment Variables

See [`.env.example`](./.env.example) for all required variables organised by section:

- `DATABASE_URL` — PostgreSQL connection string
- `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` — NextAuth v5
- `AUTH_RESEND_KEY`, `ADMIN_EMAIL` — Resend transactional email
- `R2_*` — Cloudflare R2 credentials
- `PESEPAY_*` — PesePay integration keys
- `NEXT_PUBLIC_APP_URL` — Deployed app URL
- `LAUNCH_GATE_*` — Coming-soon access control

## Deployment

The app is deployed on [Dokploy](https://dokploy.com) in the **Ticketpulse** project
(`production` environment), which contains:

| Resource | Type | Purpose |
|----------|------|---------|
| `Frontend` | Application | The Next.js app, built from the repo `Dockerfile` |
| PostgreSQL | Database | Production database (`DATABASE_URL`) |
| `OpenWA Fresh` | Compose | WhatsApp gateway (`OPENWA_*` variables) |

Set all variables from `.env.example` in the `Frontend` application's environment settings
in Dokploy. Leave `AUTH_URL`/`NEXTAUTH_URL` unset in production so Auth.js keeps the role
subdomain (admin/organizer), and set `AUTH_COOKIE_DOMAIN` to share the session across them.
Use the database's internal Dokploy hostname for `DATABASE_URL` when the app runs on the
same server.

### Dokploy CLI

```bash
dokploy auth                 # authenticate with your server URL and API key
dokploy project all          # list projects (look for "Ticketpulse")
dokploy application --help   # deploy / inspect the Frontend app
```

Never commit API keys or connection strings; keep them in Dokploy or `.env.local`.

## Flutter organizer app

The native Android/iOS organizer app lives in [`flutter_organizer/`](./flutter_organizer/README.md).
It includes sign-in, event operations, customer orders, QR check-in, and payout
status, using the shared backend. See its README for setup, API contracts, and
build verification. The Expo app in `mobile/` remains a separate project.
