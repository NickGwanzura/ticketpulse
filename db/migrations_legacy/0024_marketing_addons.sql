ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "sponsored" boolean DEFAULT false;
--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "sponsor_name" text;
--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "sponsor_logo_url" text;
--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "sponsored_at" timestamp;
--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "sponsorship_expires_at" timestamp;
--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "design_request_pending" boolean DEFAULT false;
--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "design_brief" text;
--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "design_logo_url" text;
--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "design_delivered" boolean DEFAULT false;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "organizer_packages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "slug" text NOT NULL UNIQUE,
  "description" text,
  "price" decimal(10, 2) NOT NULL,
  "currency" text DEFAULT 'USD',
  "duration_hours" integer,
  "features" json DEFAULT '[]'::json,
  "active" boolean DEFAULT true,
  "created_at" timestamp DEFAULT now()
);
