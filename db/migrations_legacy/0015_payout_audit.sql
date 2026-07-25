-- Add new payout statuses to the enum
ALTER TYPE "payout_status" ADD VALUE IF NOT EXISTS 'rejected';
ALTER TYPE "payout_status" ADD VALUE IF NOT EXISTS 'failed';
ALTER TYPE "payout_status" ADD VALUE IF NOT EXISTS 'cancelled';

-- Add rejection_reason column
ALTER TABLE "payouts" ADD COLUMN IF NOT EXISTS "rejection_reason" text;

-- Add proof_reference column (for proof of payment reference/upload)
ALTER TABLE "payouts" ADD COLUMN IF NOT EXISTS "proof_reference" text;

-- Add reviewed_by column (who approved/rejected)
ALTER TABLE "payouts" ADD COLUMN IF NOT EXISTS "reviewed_by" text;

-- Payout audit log table
CREATE TABLE IF NOT EXISTS "payout_audit_log" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "payout_id" uuid NOT NULL REFERENCES "payouts"("id") ON DELETE CASCADE,
  "action" text NOT NULL,
  "from_status" "payout_status",
  "to_status" "payout_status",
  "performed_by" text NOT NULL,
  "notes" text,
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "payout_audit_log_payout_id_idx" ON "payout_audit_log"("payout_id");
CREATE INDEX IF NOT EXISTS "payout_audit_log_created_idx" ON "payout_audit_log"("created_at");
