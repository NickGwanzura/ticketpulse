ALTER TABLE "velocity_settlements" ADD COLUMN IF NOT EXISTS "event_id" uuid REFERENCES "events"("id") ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS "velocity_settlements_event_idx" ON "velocity_settlements"("event_id");
