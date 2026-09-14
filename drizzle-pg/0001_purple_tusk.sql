CREATE TABLE "email_outbox" (
	"key" text PRIMARY KEY NOT NULL,
	"message_json" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"available_at" timestamp with time zone DEFAULT now() NOT NULL,
	"locked_at" timestamp with time zone,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_events" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"object_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "checkout_session_id" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "checkout_attempt_key" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "checkout_fingerprint" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "paid_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "stock_reserved_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "stock_released_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "reservation_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "refunded_cents" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "quote_requests" ADD COLUMN "checkout_session_id" text;--> statement-breakpoint
ALTER TABLE "quote_requests" ADD COLUMN "offer_version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "quote_requests" ADD COLUMN "paid_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "quote_requests" ADD COLUMN "stripe_payment_intent_id" text;--> statement-breakpoint
ALTER TABLE "quote_requests" ADD COLUMN "paid_price_cents" integer;--> statement-breakpoint
ALTER TABLE "quote_requests" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
CREATE INDEX "email_outbox_pending_idx" ON "email_outbox" USING btree ("sent_at","available_at");--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_checkout_session_id_unique" UNIQUE("checkout_session_id");--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_checkout_attempt_key_unique" UNIQUE("checkout_attempt_key");--> statement-breakpoint
ALTER TABLE "quote_requests" ADD CONSTRAINT "quote_requests_checkout_session_id_unique" UNIQUE("checkout_session_id");--> statement-breakpoint
ALTER TABLE "quote_requests" ADD CONSTRAINT "quote_requests_stripe_payment_intent_id_unique" UNIQUE("stripe_payment_intent_id");