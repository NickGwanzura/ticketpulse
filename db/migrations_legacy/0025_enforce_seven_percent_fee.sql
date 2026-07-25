-- TicketPulse charges one fixed platform fee: 7% per ticket sold.
-- Normalize legacy per-user/settings values so operational data matches policy.
ALTER TABLE "users"
  ALTER COLUMN "commission_rate" SET DEFAULT '7.00';

UPDATE "users"
SET "commission_rate" = '7.00', "updated_at" = NOW()
WHERE "commission_rate" IS DISTINCT FROM '7.00';

INSERT INTO "platform_settings" ("key", "value", "env", "updated_at")
VALUES ('platform_fee_percent', to_json('7.00'::text), 'prod', NOW())
ON CONFLICT ("key", "env") DO UPDATE
SET "value" = EXCLUDED."value", "updated_at" = NOW();
