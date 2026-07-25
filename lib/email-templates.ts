/**
 * Barrel re-export — this file used to be 1,595 lines of every email
 * template in one place. Split by family into lib/email-templates/* so no
 * single file carries the whole surface, without changing any existing
 * `from "@/lib/email-templates"` import across the app.
 */
export * from "./email-templates/shared"
export * from "./email-templates/transactional"
export * from "./email-templates/organizer"
export * from "./email-templates/admin"
