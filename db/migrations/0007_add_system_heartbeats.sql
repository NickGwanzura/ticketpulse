CREATE TABLE "system_heartbeats" (
	"key" text PRIMARY KEY NOT NULL,
	"last_success_at" timestamp,
	"last_error_at" timestamp,
	"last_error" text,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
