import { Pool } from "pg"
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres"
import * as schema from "./schema"

type DBType = NodePgDatabase<typeof schema>

// Eager init when DATABASE_URL is present so libraries like
// @auth/drizzle-adapter that introspect the db at construction
// time see a real Drizzle instance, not a Proxy. When the env is
// missing (Next.js page-data collection without secrets), fall
// back to a Proxy that throws on first real use.
const url = process.env.DATABASE_URL

// connectionTimeoutMillis matters: pg's default is 0 (wait forever), so if the
// DB is unreachable a health check or page render hangs indefinitely instead
// of failing fast with a readable error.
const pool = url
  ? new Pool({ connectionString: url, max: 10, idleTimeoutMillis: 30000, connectionTimeoutMillis: 5000 })
  : null

// An unhandled `error` event on an idle pooled connection crashes the
// Node process, producing the 500→503 pattern.
pool?.on("error", (err: Error) => {
  console.error("[db] idle pool connection error", err)
})

export const db: DBType = pool
  ? drizzle(pool, { schema })
  : (new Proxy({} as DBType, {
      get() {
        throw new Error(
          "DATABASE_URL is not set. Add it to .env.local for local development, or to your hosting environment for production."
        )
      },
    }))

export type DB = DBType
