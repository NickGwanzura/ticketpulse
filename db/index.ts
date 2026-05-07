import { neon } from "@neondatabase/serverless"
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http"
import * as schema from "./schema"

type DBType = NeonHttpDatabase<typeof schema>

let cached: DBType | null = null

function getDb(): DBType {
  if (cached) return cached
  const url = process.env.DATABASE_URL
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Add it to .env.local for local development, or to your hosting environment for production."
    )
  }
  cached = drizzle(neon(url), { schema })
  return cached
}

// Lazy proxy so module import does not call `neon()` at load time.
// Next.js page-data collection (and other module-evaluation passes)
// runs without secrets present; deferring the connection until first
// query lets the build pass while still erroring loudly on real use.
export const db = new Proxy({} as DBType, {
  get(_target, prop) {
    const real = getDb() as unknown as Record<string | symbol, unknown>
    const value = real[prop as string]
    return typeof value === "function" ? (value as (...a: unknown[]) => unknown).bind(real) : value
  },
})

export type DB = DBType
