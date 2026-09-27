ALTER TABLE "orders" ADD COLUMN "channel" text DEFAULT 'web' NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "agent_name" text;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_channel_valid" CHECK ("orders"."channel" IN ('web','stripe_acs','mpp','acp','ucp','x402'));