ALTER TABLE "ticket_tiers"
  ADD COLUMN "early_bird_price" decimal(10, 2),
  ADD COLUMN "early_bird_until" timestamp,
  ADD COLUMN "early_bird_quantity" integer;
