-- Platform settings table
CREATE TABLE IF NOT EXISTS "platform_settings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "platform_name" text NOT NULL DEFAULT 'TicketPulse',
  "support_email" text NOT NULL DEFAULT 'support@ticketpulse.co.zw',
  "default_currency" text NOT NULL DEFAULT 'USD',
  "platform_fee_percent" decimal(5,2) NOT NULL DEFAULT '8',
  "maintenance_mode" boolean NOT NULL DEFAULT false,
  "updated_at" timestamp NOT NULL DEFAULT now()
);

-- Insert default settings row
INSERT INTO "platform_settings" ("id") VALUES ('00000000-0000-0000-0000-000000000001')
ON CONFLICT DO NOTHING;

-- Payouts enum
DO $$ BEGIN
  CREATE TYPE "payout_status" AS ENUM ('pending', 'approved', 'processing', 'paid', 'held');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "payout_method" AS ENUM ('ecocash', 'bank_usd', 'bank_zar');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Payouts table
CREATE TABLE IF NOT EXISTS "payouts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "event_id" uuid REFERENCES "events"("id") ON DELETE SET NULL,
  "amount" decimal(10,2) NOT NULL,
  "currency" text NOT NULL DEFAULT 'USD',
  "method" "payout_method" NOT NULL DEFAULT 'ecocash',
  "status" "payout_status" NOT NULL DEFAULT 'pending',
  "account_number" text,
  "account_name" text,
  "bank_name" text,
  "processed_at" timestamp,
  "processed_by" text,
  "notes" text,
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "payouts_user_idx" ON "payouts"("user_id");
CREATE INDEX IF NOT EXISTS "payouts_status_idx" ON "payouts"("status");
CREATE INDEX IF NOT EXISTS "payouts_created_idx" ON "payouts"("created_at");
