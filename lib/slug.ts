import { eq } from "drizzle-orm"
import { db as defaultDb } from "@/db"
import { events } from "@/db/schema"

/**
 * Convert a title into a URL-safe slug.
 * Lowercase, strip diacritics, replace non-alphanumerics with `-`,
 * collapse repeats, trim leading/trailing dashes.
 */
export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip combining diacritics
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
}

/**
 * Generate a unique slug for an event title. Retries with `-2`, `-3`, ...
 * until no row in `events.slug` collides. Optionally exclude an existing
 * event id (useful when renaming an event without re-slugging itself).
 */
export async function generateUniqueSlug(
  title: string,
  options: { db?: typeof defaultDb; excludeEventId?: string } = {},
): Promise<string> {
  const db = options.db ?? defaultDb
  const base = slugify(title) || "event"
  let candidate = base
  let suffix = 2
  // Bound iterations defensively.
  for (let i = 0; i < 50; i++) {
    const [row] = await db
      .select({ id: events.id })
      .from(events)
      .where(eq(events.slug, candidate))
      .limit(1)
    if (!row || (options.excludeEventId && row.id === options.excludeEventId)) {
      return candidate
    }
    candidate = `${base}-${suffix}`
    suffix += 1
  }
  // Fallback: append a short random tail if everything collides.
  return `${base}-${Math.random().toString(36).slice(2, 7)}`
}
