import { Pool, neonConfig } from "@neondatabase/serverless"
import { drizzle, type NeonDatabase } from "drizzle-orm/neon-serverless"
import * as schema from "./schema"

type DBType = NeonDatabase<typeof schema>

// Configure WebSocket for Neon. Node 18+ has global WebSocket.
neonConfig.webSocketConstructor = WebSocket

// Eager init when DATABASE_URL is present so libraries like
// @auth/drizzle-adapter that introspect the db at construction
// time see a real Drizzle instance, not a Proxy. When the env is
// missing (Next.js page-data collection without secrets), fall
// back to a Proxy that throws on first real use.
const url = process.env.DATABASE_URL

// Allow a modest pool of connections. The Neon serverless driver
// defaults to 1, which serialises all DB queries — bumping to 10
// lets concurrent page renders and API calls run in parallel.
const pool = url ? new Pool({ connectionString: url, max: 10 }) : null

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
