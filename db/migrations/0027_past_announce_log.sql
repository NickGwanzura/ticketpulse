CREATE TABLE IF NOT EXISTS "past_announce_log" (
  "id"              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  "event_id"        uuid        NOT NULL REFERENCES "events"("id") ON DELETE CASCADE,
  "recipient_email" varchar(320) NOT NULL,
  "sent_at"         timestamp   NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "past_announce_log_event_email_idx"
  ON "past_announce_log" ("event_id", "recipient_email");
