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

1. Copy .env.local and fill in values
2. Get DATABASE_URL from neon.tech
3. Run: npm run auth:secret
4. Set up Google OAuth at console.cloud.google.com
5. npm run db:push
6. npm run dev

## Scripts
- npm run dev
- npm run db:push        Push schema to Neon
- npm run db:generate    Generate migrations
- npm run db:migrate     Apply migrations
- npm run db:studio      Open Drizzle Studio
- npm run auth:secret    Generate AUTH_SECRET

