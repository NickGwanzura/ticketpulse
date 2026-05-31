ALTER TABLE "tickets"
  ADD COLUMN "transfer_token" text,
  ADD COLUMN "transfer_to_email" text,
  ADD COLUMN "transfer_to_name" text,
  ADD COLUMN "transfer_expires_at" timestamp,
  ADD COLUMN "transferred_at" timestamp,
  ADD COLUMN "holder_name" text,
  ADD COLUMN "holder_email" text;

ALTER TABLE "tickets" ADD CONSTRAINT "tickets_transfer_token_unique" UNIQUE("transfer_token");
