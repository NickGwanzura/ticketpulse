ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "organizer_address" text,
  ADD COLUMN IF NOT EXISTS "organizer_category" text,
  ADD COLUMN IF NOT EXISTS "organizer_experience_years" integer;
