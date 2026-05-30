DO $$ BEGIN
  CREATE TYPE "notification_type" AS ENUM (
    'order_paid',
    'order_cancelled',
    'order_refunded',
    'ticket_issued',
    'ticket_checked_in',
    'payout_requested',
    'payout_paid',
    'event_published',
    'event_sold_out',
    'system'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "notifications" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" text REFERENCES "users"("id") ON DELETE CASCADE,
  "type" "notification_type" NOT NULL,
  "title" text NOT NULL,
  "body" text NOT NULL,
  "link" text,
  "read" boolean NOT NULL DEFAULT false,
  "metadata" jsonb,
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "notifications_user_id_idx" ON "notifications"("user_id");
CREATE INDEX IF NOT EXISTS "notifications_read_idx" ON "notifications"("read");
CREATE INDEX IF NOT EXISTS "notifications_created_idx" ON "notifications"("created_at");
