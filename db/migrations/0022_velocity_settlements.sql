CREATE TABLE IF NOT EXISTS "velocity_settlements" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "settlement_date" timestamp NOT NULL,
  "period_start" timestamp,
  "period_end" timestamp,
  "amount" decimal(10,2) NOT NULL,
  "currency" text NOT NULL DEFAULT 'USD',
  "reference" text NOT NULL,
  "notes" text,
  "recorded_by" text,
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "velocity_settlements_reference_idx" ON "velocity_settlements"("reference");
CREATE INDEX IF NOT EXISTS "velocity_settlements_date_idx" ON "velocity_settlements"("settlement_date");
CREATE INDEX IF NOT EXISTS "velocity_settlements_created_idx" ON "velocity_settlements"("created_at");
