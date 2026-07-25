# Legacy migrations (0000–0033)

These files predate the 2026-07-19 baseline reset and are kept for history only —
they are **not** read by `drizzle-kit` anymore (the journal/snapshots that indexed
them were removed). Migration history restarted at `db/migrations/0000_baseline.sql`,
which reflects the schema as of that date.

Root cause: several migrations after `0028` (including a duplicate `0014_*`) were
hand-written and applied via `npm run db:push` without ever running
`drizzle-kit generate`, so the snapshot chain in `meta/` silently fell out of sync
and `drizzle-kit generate` stopped working. `db:push` (schema.ts → live DB diff) is
this project's actual deploy mechanism — treat it as the source of truth, not
`db:migrate`. If you add new migration files by hand instead of running
`db:generate`, this will happen again.
