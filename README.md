# TicketPulse Zimbabwe

Zimbabwe's premier event ticketing platform. Built with Next.js 15, Neon Postgres, Drizzle ORM, Auth.js v5.

## Tech Stack
- Framework: Next.js 15 (App Router)
- Database: Neon Postgres (serverless)
- ORM: Drizzle ORM
- Auth: Auth.js v5 (next-auth@beta)
- Styling: Tailwind CSS

## Tier 1 Features
- Merch shop: per-event store with sizes, colors, pickup and delivery
- Shuttle bookings: seat selection, operator ratings, departure points
- Vendor marketplace: caterers, bar, photographers book packages per event
- Photo gallery: post-event galleries with paid photo pack downloads

## Setup

1. Copy `.env.example` to `.env.local` and fill in values
2. Get DATABASE_URL from neon.tech
3. Run: npm run auth:secret
4. Set up Google OAuth at console.cloud.google.com
5. npm run db:push
6. npm run dev

## Environment variables

| Variable | Description |
|---|---|
| `AUTH_URL` | Canonical public URL — must be `https://ticketpulse.tech` in production (not the Railway internal domain) |
| `AUTH_SECRET` | Random secret for Auth.js — generate with `npm run auth:secret` |
| `AUTH_GOOGLE_ID` | Google OAuth client ID |
| `AUTH_GOOGLE_SECRET` | Google OAuth client secret |
| `AUTH_RESEND_KEY` | Resend API key for magic-link emails |
| `DATABASE_URL` | Neon Postgres connection string |

## Scripts
- npm run dev
- npm run db:push        Push schema to Neon
- npm run db:generate    Generate migrations
- npm run db:migrate     Apply migrations
- npm run db:studio      Open Drizzle Studio
- npm run auth:secret    Generate AUTH_SECRET

