ALTER TABLE "users" ADD COLUMN "organizer_frozen_at" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "organizer_freeze_reason" text;