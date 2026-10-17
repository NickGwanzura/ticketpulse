# Production database schema check

TicketPulse derives its production schema from `db/schema.ts`. The current
deployment workflow uses `drizzle-kit push`; the legacy migrations under
`db/migrations_legacy` are not applied, and `db:migrate` is not the production
schema source of truth.

Before deploying a schema change, point `DATABASE_URL` at the intended
production database, review the proposed `npm run db:push` changes, and apply
them. Then run `npm run db:check`. The check verifies the columns used by sign-in,
organizer event setup, ticket sales, and the application health endpoint.

The Docker image runs the same check before starting Next.js. A missing column
prints its table and name and exits with instructions to apply `npm run db:push`.
For a running app, `GET /api/health` returns HTTP 503 with `schema: "missing"`
and a `missingColumns` list; the Docker health check and Dokploy can then flag
the container as unhealthy. Add columns to
`db/required-schema-columns.json` when a new critical runtime dependency is
introduced.

Do not use `--force` for production schema pushes. Review Drizzle's proposed
changes first and take the normal database backup before applying destructive
changes.
