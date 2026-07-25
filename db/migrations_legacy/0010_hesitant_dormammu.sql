CREATE TABLE "ticket_question_responses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"question_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"response" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ticket_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"question" text NOT NULL,
	"required" boolean DEFAULT false,
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "ticket_question_responses" ADD CONSTRAINT "ticket_question_responses_question_id_ticket_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."ticket_questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_question_responses" ADD CONSTRAINT "ticket_question_responses_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_questions" ADD CONSTRAINT "ticket_questions_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ticket_question_responses_question_id_idx" ON "ticket_question_responses" USING btree ("question_id");--> statement-breakpoint
CREATE INDEX "ticket_question_responses_order_id_idx" ON "ticket_question_responses" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "ticket_questions_event_id_idx" ON "ticket_questions" USING btree ("event_id");