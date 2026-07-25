-- Change metadata column from json to jsonb for GIN index support
ALTER TABLE "orders" ALTER COLUMN "metadata" TYPE jsonb USING "metadata"::jsonb;

-- Composite index for filtering orders by event + status
CREATE INDEX IF NOT EXISTS "orders_status_event_idx" ON "orders" ("event_id", "status");

-- GIN index for JSON queries like metadata->>'velocity' IS NOT NULL
CREATE INDEX IF NOT EXISTS "orders_metadata_gin_idx" ON "orders" USING gin ("metadata");
