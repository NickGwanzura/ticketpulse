CREATE TABLE IF NOT EXISTS "mobile_sessions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "refresh_token_hash" text NOT NULL UNIQUE,
  "expires_at" timestamp NOT NULL,
  "revoked_at" timestamp,
  "last_used_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "mobile_sessions_user_id_idx" ON "mobile_sessions" ("user_id");
CREATE INDEX IF NOT EXISTS "mobile_sessions_expires_at_idx" ON "mobile_sessions" ("expires_at");

CREATE TABLE IF NOT EXISTS "support_cases" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "order_id" uuid NOT NULL REFERENCES "orders"("id") ON DELETE CASCADE,
  "event_id" uuid NOT NULL REFERENCES "events"("id") ON DELETE CASCADE,
  "subject" text NOT NULL,
  "priority" text DEFAULT 'normal' NOT NULL,
  "status" text DEFAULT 'open' NOT NULL,
  "note" text,
  "assigned_to" text REFERENCES "users"("id") ON DELETE SET NULL,
  "opened_by" text NOT NULL REFERENCES "users"("id"),
  "resolved_by" text REFERENCES "users"("id") ON DELETE SET NULL,
  "opened_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  "resolved_at" timestamp,
  "resolution_note" text
);
CREATE INDEX IF NOT EXISTS "support_cases_order_id_idx" ON "support_cases" ("order_id");
CREATE INDEX IF NOT EXISTS "support_cases_event_status_idx" ON "support_cases" ("event_id", "status");
CREATE INDEX IF NOT EXISTS "support_cases_assigned_to_idx" ON "support_cases" ("assigned_to");

CREATE TABLE IF NOT EXISTS "support_case_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "case_id" uuid NOT NULL REFERENCES "support_cases"("id") ON DELETE CASCADE,
  "actor_id" text NOT NULL REFERENCES "users"("id"),
  "action" text NOT NULL,
  "note" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "support_case_events_case_id_idx" ON "support_case_events" ("case_id");
