import { neon } from "@neondatabase/serverless"
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http"
import * as schema from "./schema"

type DBType = NeonHttpDatabase<typeof schema>

// Eager init when DATABASE_URL is present so libraries like
// @auth/drizzle-adapter that introspect the db at construction
// time see a real Drizzle instance, not a Proxy. When the env is
// missing (Next.js page-data collection without secrets), fall
// back to a Proxy that throws on first real use.
const url = process.env.DATABASE_URL

export const db: DBType = url
  ? drizzle(neon(url), { schema })
  : (new Proxy({} as DBType, {
      get() {
        throw new Error(
          "DATABASE_URL is not set. Add it to .env.local for local development, or to your hosting environment for production."
        )
      },
    }))

export type DB = DBType
