CREATE TYPE "public"."invite_status" AS ENUM('pending', 'accepted', 'declined', 'expired');--> statement-breakpoint
CREATE TYPE "public"."staff_role" AS ENUM('security', 'usher', 'dj_sound', 'bar_staff', 'vip_host', 'media', 'other');--> statement-breakpoint
CREATE TABLE "event_organisers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"invited_by" text NOT NULL,
	"role" text DEFAULT 'editor',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "organiser_invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"invited_by" text NOT NULL,
	"email" text NOT NULL,
	"role" text DEFAULT 'editor',
	"token" text NOT NULL,
	"status" "invite_status" DEFAULT 'pending',
	"accepted_at" timestamp,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "organiser_invites_token_unique" UNIQUE("token")
);
--> statement-breakpoint
ALTER TABLE "tickets" ADD COLUMN "is_staff_ticket" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "tickets" ADD COLUMN "staff_role" "staff_role";--> statement-breakpoint
ALTER TABLE "tickets" ADD COLUMN "staff_name" text;--> statement-breakpoint
ALTER TABLE "tickets" ADD COLUMN "staff_phone" text;--> statement-breakpoint
ALTER TABLE "event_organisers" ADD CONSTRAINT "event_organisers_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_organisers" ADD CONSTRAINT "event_organisers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_organisers" ADD CONSTRAINT "event_organisers_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organiser_invites" ADD CONSTRAINT "organiser_invites_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organiser_invites" ADD CONSTRAINT "organiser_invites_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "event_organisers_event_user_idx" ON "event_organisers" USING btree ("event_id","user_id");--> statement-breakpoint
CREATE INDEX "event_organisers_event_id_idx" ON "event_organisers" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "event_organisers_user_id_idx" ON "event_organisers" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "organiser_invites_event_id_idx" ON "organiser_invites" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "organiser_invites_token_idx" ON "organiser_invites" USING btree ("token");--> statement-breakpoint
CREATE UNIQUE INDEX "organiser_invites_event_email_idx" ON "organiser_invites" USING btree ("event_id","email");--> statement-breakpoint
CREATE INDEX "tickets_staff_event_idx" ON "tickets" USING btree ("event_id","is_staff_ticket");