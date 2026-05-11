DO $$ BEGIN
  CREATE TYPE "platform_env" AS ENUM ('dev', 'stage', 'prod');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "settings_proposal_status" AS ENUM ('pending_approval', 'approved', 'rejected', 'applied', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "settings_proposal_action" AS ENUM ('save', 'rollback');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "platform_settings"
  ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS "env" "platform_env" NOT NULL DEFAULT 'prod';

ALTER TABLE "platform_settings"
  DROP CONSTRAINT IF EXISTS "platform_settings_pkey";

UPDATE "platform_settings"
SET "id" = gen_random_uuid()
WHERE "id" IS NULL;

ALTER TABLE "platform_settings"
  ALTER COLUMN "id" SET NOT NULL;

ALTER TABLE "platform_settings"
  ADD CONSTRAINT "platform_settings_pkey" PRIMARY KEY ("id");

CREATE UNIQUE INDEX IF NOT EXISTS "platform_settings_env_key_uidx"
  ON "platform_settings" ("env", "key");

CREATE INDEX IF NOT EXISTS "platform_settings_env_idx"
  ON "platform_settings" ("env");

CREATE INDEX IF NOT EXISTS "platform_settings_key_idx"
  ON "platform_settings" ("key");

ALTER TABLE "settings_audit_logs"
  ADD COLUMN IF NOT EXISTS "env" "platform_env" NOT NULL DEFAULT 'prod',
  ADD COLUMN IF NOT EXISTS "request_id" text,
  ADD COLUMN IF NOT EXISTS "hash" text,
  ADD COLUMN IF NOT EXISTS "prev_hash" text,
  ADD COLUMN IF NOT EXISTS "signature" text,
  ADD COLUMN IF NOT EXISTS "immutable" boolean NOT NULL DEFAULT true;

UPDATE "settings_audit_logs"
SET
  "hash" = COALESCE("hash", md5(gen_random_uuid()::text || COALESCE("id"::text, ''))),
  "signature" = COALESCE("signature", md5(gen_random_uuid()::text || COALESCE("id"::text, '')))
WHERE "hash" IS NULL OR "signature" IS NULL;

ALTER TABLE "settings_audit_logs"
  ALTER COLUMN "hash" SET NOT NULL,
  ALTER COLUMN "signature" SET NOT NULL;

CREATE INDEX IF NOT EXISTS "settings_audit_logs_env_idx"
  ON "settings_audit_logs" ("env");

CREATE UNIQUE INDEX IF NOT EXISTS "settings_audit_logs_hash_uidx"
  ON "settings_audit_logs" ("hash");

CREATE TABLE IF NOT EXISTS "settings_change_proposals" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "env" "platform_env" NOT NULL DEFAULT 'prod',
  "key" text NOT NULL,
  "action" "settings_proposal_action" NOT NULL DEFAULT 'save',
  "status" "settings_proposal_status" NOT NULL DEFAULT 'pending_approval',
  "source_audit_log_id" uuid REFERENCES "settings_audit_logs"("id"),
  "proposed_old_value" json,
  "proposed_new_value" json NOT NULL,
  "reason" text NOT NULL,
  "requested_by_user_id" text REFERENCES "users"("id"),
  "requested_by_email" text,
  "requested_by_role" text,
  "approved_by_user_id" text REFERENCES "users"("id"),
  "approved_by_email" text,
  "approved_by_role" text,
  "approved_at" timestamp,
  "rejected_by_user_id" text REFERENCES "users"("id"),
  "rejected_by_email" text,
  "rejected_by_role" text,
  "rejected_at" timestamp,
  "reject_reason" text,
  "effective_at" timestamp,
  "apply_after" timestamp,
  "applied_at" timestamp,
  "applied_audit_log_id" uuid REFERENCES "settings_audit_logs"("id"),
  "expected_version" integer,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "settings_change_proposals_env_idx"
  ON "settings_change_proposals" ("env");
CREATE INDEX IF NOT EXISTS "settings_change_proposals_key_idx"
  ON "settings_change_proposals" ("key");
CREATE INDEX IF NOT EXISTS "settings_change_proposals_status_idx"
  ON "settings_change_proposals" ("status");
CREATE INDEX IF NOT EXISTS "settings_change_proposals_apply_after_idx"
  ON "settings_change_proposals" ("apply_after");
CREATE INDEX IF NOT EXISTS "settings_change_proposals_effective_at_idx"
  ON "settings_change_proposals" ("effective_at");

CREATE TABLE IF NOT EXISTS "settings_webhook_subscriptions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "env" "platform_env" NOT NULL DEFAULT 'prod',
  "url" text NOT NULL,
  "secret" text NOT NULL,
  "event_types" json NOT NULL DEFAULT '[]'::json,
  "active" boolean NOT NULL DEFAULT true,
  "created_by_user_id" text REFERENCES "users"("id"),
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "settings_webhook_subscriptions_env_idx"
  ON "settings_webhook_subscriptions" ("env");
CREATE INDEX IF NOT EXISTS "settings_webhook_subscriptions_active_idx"
  ON "settings_webhook_subscriptions" ("active");

CREATE TABLE IF NOT EXISTS "settings_alert_outbox" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "env" "platform_env" NOT NULL DEFAULT 'prod',
  "event_type" text NOT NULL,
  "payload" json NOT NULL,
  "status" text NOT NULL DEFAULT 'pending',
  "attempts" integer NOT NULL DEFAULT 0,
  "next_attempt_at" timestamp,
  "processed_at" timestamp,
  "last_error" text,
  "webhook_subscription_id" uuid REFERENCES "settings_webhook_subscriptions"("id"),
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "settings_alert_outbox_env_idx"
  ON "settings_alert_outbox" ("env");
CREATE INDEX IF NOT EXISTS "settings_alert_outbox_status_idx"
  ON "settings_alert_outbox" ("status");
CREATE INDEX IF NOT EXISTS "settings_alert_outbox_event_type_idx"
  ON "settings_alert_outbox" ("event_type");
CREATE INDEX IF NOT EXISTS "settings_alert_outbox_next_attempt_at_idx"
  ON "settings_alert_outbox" ("next_attempt_at");
