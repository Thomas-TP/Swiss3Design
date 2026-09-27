CREATE TABLE "agent_checkout_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"protocol" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"state" jsonb NOT NULL,
	"order_id" text,
	"agent" text,
	"customer_id" text,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agent_checkout_sessions_status_valid" CHECK ("agent_checkout_sessions"."status" IN ('open','completed','canceled')),
	CONSTRAINT "agent_checkout_sessions_protocol_valid" CHECK ("agent_checkout_sessions"."protocol" IN ('acp','ucp'))
);
--> statement-breakpoint
ALTER TABLE "agent_checkout_sessions" ADD CONSTRAINT "agent_checkout_sessions_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_checkout_sessions_expiry_idx" ON "agent_checkout_sessions" USING btree ("expires_at");