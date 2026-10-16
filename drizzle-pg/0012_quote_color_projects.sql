CREATE TABLE "quote_color_projects" (
	"quote_id" text PRIMARY KEY NOT NULL,
	"file_key" text NOT NULL,
	"file_name" text NOT NULL,
	"summary" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "quote_color_projects" ADD CONSTRAINT "quote_color_projects_quote_id_quote_requests_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quote_requests"("id") ON DELETE cascade ON UPDATE no action;