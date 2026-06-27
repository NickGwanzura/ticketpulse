-- Add promo_images array to events for additional marketing photos on the event overview page.
ALTER TABLE "events"
  ADD COLUMN IF NOT EXISTS "promo_images" json DEFAULT '[]'::json;
