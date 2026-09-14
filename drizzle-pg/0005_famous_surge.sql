CREATE TABLE "status_events" (
	"id" text PRIMARY KEY NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"from_status" text,
	"to_status" text NOT NULL,
	"source" text NOT NULL,
	"actor_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "status_events_entity_valid" CHECK ("status_events"."entity_type" IN ('order','quote')),
	CONSTRAINT "status_events_source_valid" CHECK ("status_events"."source" IN ('checkout','payment','admin','customer','system'))
);
--> statement-breakpoint
CREATE INDEX "status_events_entity_idx" ON "status_events" USING btree ("entity_type","entity_id","created_at");