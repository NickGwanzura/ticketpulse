-- Add 'cash' to payout_method enum
ALTER TYPE payout_method ADD VALUE IF NOT EXISTS 'cash';

-- Add balance_snapshot jsonb column to payouts
ALTER TABLE payouts ADD COLUMN IF NOT EXISTS balance_snapshot jsonb;

-- Partial unique index to prevent duplicate active payouts per user (fix 4.2)
-- Prevents two concurrent transactions from both inserting a pending/approved/processing payout
CREATE UNIQUE INDEX IF NOT EXISTS payouts_one_active_per_user
  ON payouts (user_id)
  WHERE status IN ('pending', 'approved', 'processing');
