ALTER TYPE "public"."order_status" ADD VALUE 'completed' BEFORE 'cancelled';--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "completed_at" timestamp;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "completed_by" text;
