-- Promo codes are no longer a TicketPulse feature (removed from checkout, WhatsApp
-- ordering and the organiser dashboard). Nothing in the app reads this table.
-- Review before applying: this permanently deletes any promo code rows.
DROP TABLE IF EXISTS "promo_codes";

--> statement-breakpoint
DROP TYPE IF EXISTS "promo_code_type";
