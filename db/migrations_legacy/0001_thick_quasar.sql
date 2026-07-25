ALTER TYPE "public"."order_status" ADD VALUE 'awaiting_verification' BEFORE 'paid';--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "guest_email" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "guest_name" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "guest_phone" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "verification_sent_at" timestamp;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "verification_expires" timestamp;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "verified_at" timestamp;--> statement-breakpoint
CREATE INDEX "orders_guest_email_idx" ON "orders" USING btree ("guest_email");