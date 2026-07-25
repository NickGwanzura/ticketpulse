CREATE TABLE IF NOT EXISTS event_moderation_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  admin_id text REFERENCES users(id) ON DELETE SET NULL,
  action text NOT NULL,
  reason text,
  created_at timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS event_moderation_log_event_id_idx ON event_moderation_log(event_id);
