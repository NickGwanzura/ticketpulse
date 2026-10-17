import { readFile } from "node:fs/promises"
import { Client } from "pg"
import dotenv from "dotenv"

dotenv.config({ path: ".env.local" })
dotenv.config()

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  console.error("Database schema check failed: DATABASE_URL is not configured.")
  process.exit(1)
}

const requiredColumns = JSON.parse(
  await readFile(new URL("../db/required-schema-columns.json", import.meta.url), "utf8"),
)
const client = new Client({ connectionString: databaseUrl, connectionTimeoutMillis: 5000 })
function describeError(error) {
  if (error instanceof AggregateError) return error.errors.map(describeError).join("; ")
  if (error instanceof Error) {
    const code = "code" in error && typeof error.code === "string" ? `${error.code}: ` : ""
    return `${code}${error.message || error.name}`
  }
  return String(error)
}

try {
  await client.connect()
  const tables = requiredColumns.map(([table]) => table)
  const columns = requiredColumns.map(([, column]) => column)
  const result = await client.query(
    `SELECT expected.table_name, expected.column_name
       FROM unnest($1::text[], $2::text[]) AS expected(table_name, column_name)
       LEFT JOIN information_schema.columns actual
         ON actual.table_schema = current_schema()
        AND actual.table_name = expected.table_name
        AND actual.column_name = expected.column_name
      WHERE actual.column_name IS NULL
      ORDER BY expected.table_name, expected.column_name`,
    [tables, columns],
  )

  if (result.rows.length > 0) {
    console.error("Database schema check failed. Required columns are missing:")
    for (const row of result.rows) console.error(`  - ${row.table_name}.${row.column_name}`)
    console.error("Apply the current Drizzle schema with `npm run db:push`, then run `npm run db:check` again before deploying.")
    process.exitCode = 1
  } else {
    console.log(`Database schema check passed (${requiredColumns.length} required columns present).`)
  }
} catch (error) {
  console.error("Database schema check failed:", describeError(error))
  process.exitCode = 1
} finally {
  await client.end().catch(() => undefined)
}
