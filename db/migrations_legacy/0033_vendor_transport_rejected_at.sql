ALTER TABLE vendors ADD COLUMN IF NOT EXISTS rejected_at timestamp;
ALTER TABLE transport_operators ADD COLUMN IF NOT EXISTS rejected_at timestamp;
