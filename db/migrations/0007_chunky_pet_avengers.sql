CREATE TABLE "organizer_lifecycle_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organizer_id" text,
	"event_id" uuid,
	"step" text NOT NULL,
	"dedupe_key" text NOT NULL,
	"source" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "organizer_lifecycle_events" ADD CONSTRAINT "organizer_lifecycle_events_organizer_id_users_id_fk" FOREIGN KEY ("organizer_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organizer_lifecycle_events" ADD CONSTRAINT "organizer_lifecycle_events_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "organizer_lifecycle_organizer_created_idx" ON "organizer_lifecycle_events" USING btree ("organizer_id","created_at");--> statement-breakpoint
CREATE INDEX "organizer_lifecycle_step_created_idx" ON "organizer_lifecycle_events" USING btree ("step","created_at");--> statement-breakpoint
CREATE INDEX "organizer_lifecycle_event_idx" ON "organizer_lifecycle_events" USING btree ("event_id");--> statement-breakpoint
CREATE UNIQUE INDEX "organizer_lifecycle_dedupe_idx" ON "organizer_lifecycle_events" USING btree ("dedupe_key");--> statement-breakpoint
CREATE INDEX "analytics_events_event_created_idx" ON "analytics_events" USING btree ("event_id","created_at");--> statement-breakpoint
CREATE INDEX "events_organizer_status_idx" ON "events" USING btree ("organizer_id","status");--> statement-breakpoint
CREATE INDEX "events_status_starts_at_idx" ON "events" USING btree ("status","starts_at");--> statement-breakpoint
CREATE INDEX "orders_status_created_at_idx" ON "orders" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "users_role_approved_idx" ON "users" USING btree ("role","approved_at");--> statement-breakpoint
CREATE INDEX "users_created_at_idx" ON "users" USING btree ("created_at");