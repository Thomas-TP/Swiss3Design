CREATE TABLE "filament_consumptions" (
	"id" text PRIMARY KEY NOT NULL,
	"order_id" text,
	"quote_id" text,
	"consumed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"actor_id" text,
	"note" text,
	CONSTRAINT "filament_consumptions_order_id_unique" UNIQUE("order_id"),
	CONSTRAINT "filament_consumptions_quote_id_unique" UNIQUE("quote_id"),
	CONSTRAINT "filament_consumptions_one_source" CHECK (("filament_consumptions"."order_id" IS NOT NULL)::int + ("filament_consumptions"."quote_id" IS NOT NULL)::int = 1)
);
--> statement-breakpoint
CREATE TABLE "filament_holders" (
	"id" text PRIMARY KEY NOT NULL,
	"tare_grams" integer DEFAULT 212 NOT NULL,
	"note" text,
	"retired_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "filament_holders_tare_valid" CHECK ("filament_holders"."tare_grams" BETWEEN 50 AND 400)
);
--> statement-breakpoint
CREATE TABLE "filament_movements" (
	"id" text PRIMARY KEY NOT NULL,
	"spool_id" text NOT NULL,
	"kind" text NOT NULL,
	"delta_grams" integer NOT NULL,
	"grams_after" integer NOT NULL,
	"gross_grams" integer,
	"tare_grams" integer,
	"order_id" text,
	"quote_id" text,
	"idempotency_key" text,
	"note" text,
	"actor_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "filament_movements_idempotency_key_unique" UNIQUE("idempotency_key"),
	CONSTRAINT "filament_movements_kind_valid" CHECK ("filament_movements"."kind" IN ('receipt','consumption','weigh','adjust','empty','retire')),
	CONSTRAINT "filament_movements_after_valid" CHECK ("filament_movements"."grams_after" >= 0)
);
--> statement-breakpoint
CREATE TABLE "filament_purchases" (
	"id" text PRIMARY KEY NOT NULL,
	"supplier" text DEFAULT 'Bambu Lab Europe' NOT NULL,
	"reference" text,
	"status" text DEFAULT 'ordered' NOT NULL,
	"ordered_at" timestamp with time zone,
	"received_at" timestamp with time zone,
	"total_cents" integer,
	"total_eur_cents" integer,
	"shipping_cents" integer DEFAULT 0 NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "filament_quote_details" (
	"quote_id" text PRIMARY KEY NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"color_refs" jsonb,
	"est_grams" integer,
	"plan" jsonb,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "filament_quote_details_quantity_valid" CHECK ("filament_quote_details"."quantity" BETWEEN 1 AND 100)
);
--> statement-breakpoint
CREATE TABLE "filament_refs" (
	"id" text PRIMARY KEY NOT NULL,
	"brand" text NOT NULL,
	"range_name" text NOT NULL,
	"official_name" text NOT NULL,
	"product_code" text,
	"hex" text NOT NULL,
	"hex2" text,
	"hex3" text,
	"hex_confirmed" boolean DEFAULT true NOT NULL,
	"studio_id" text,
	"shop_color_id" text,
	"custom_ok" boolean DEFAULT false NOT NULL,
	"spool_net_grams" integer DEFAULT 1000 NOT NULL,
	"reorder_below_grams" integer DEFAULT 300 NOT NULL,
	"min_spare_spools" integer DEFAULT 0 NOT NULL,
	"price_spool_eur_cents" integer,
	"price_refill_eur_cents" integer,
	"url_spool" text,
	"url_refill" text,
	"active" boolean DEFAULT true NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "filament_refs_studio_id_unique" UNIQUE("studio_id"),
	CONSTRAINT "filament_refs_hex_valid" CHECK ("filament_refs"."hex" ~ '^#[0-9A-F]{6}$' AND ("filament_refs"."hex2" IS NULL OR "filament_refs"."hex2" ~ '^#[0-9A-F]{6}$') AND ("filament_refs"."hex3" IS NULL OR "filament_refs"."hex3" ~ '^#[0-9A-F]{6}$') AND ("filament_refs"."hex3" IS NULL OR "filament_refs"."hex2" IS NOT NULL)),
	CONSTRAINT "filament_refs_grams_valid" CHECK ("filament_refs"."spool_net_grams" > 0 AND "filament_refs"."reorder_below_grams" >= 0 AND "filament_refs"."min_spare_spools" >= 0)
);
--> statement-breakpoint
CREATE TABLE "filament_spools" (
	"id" text PRIMARY KEY NOT NULL,
	"ref_id" text NOT NULL,
	"purchase_id" text,
	"holder_id" text,
	"spool_type" text NOT NULL,
	"tare_grams" integer NOT NULL,
	"tare_confirmed" boolean DEFAULT true NOT NULL,
	"initial_grams" integer DEFAULT 1000 NOT NULL,
	"remaining_grams" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'in_stock' NOT NULL,
	"sealed" boolean DEFAULT false NOT NULL,
	"location" text,
	"slot" text,
	"cost_cents" integer,
	"purchased_at" timestamp with time zone,
	"to_confirm" boolean DEFAULT false NOT NULL,
	"last_weighed_at" timestamp with time zone,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "filament_spools_grams_valid" CHECK ("filament_spools"."tare_grams" >= 0 AND "filament_spools"."initial_grams" > 0 AND "filament_spools"."remaining_grams" >= 0),
	CONSTRAINT "filament_spools_status_valid" CHECK ("filament_spools"."status" IN ('ordered','in_stock','empty','retired')),
	CONSTRAINT "filament_spools_type_valid" CHECK ("filament_spools"."spool_type" IN ('bambu_reusable','bambu_refill','polymaker_cardboard','r3d_cardboard','other'))
);
--> statement-breakpoint
ALTER TABLE "filament_consumptions" ADD CONSTRAINT "filament_consumptions_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "filament_consumptions" ADD CONSTRAINT "filament_consumptions_quote_id_quote_requests_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quote_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "filament_movements" ADD CONSTRAINT "filament_movements_spool_id_filament_spools_id_fk" FOREIGN KEY ("spool_id") REFERENCES "public"."filament_spools"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "filament_movements" ADD CONSTRAINT "filament_movements_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "filament_movements" ADD CONSTRAINT "filament_movements_quote_id_quote_requests_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quote_requests"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "filament_quote_details" ADD CONSTRAINT "filament_quote_details_quote_id_quote_requests_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quote_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "filament_refs" ADD CONSTRAINT "filament_refs_shop_color_id_filament_colors_id_fk" FOREIGN KEY ("shop_color_id") REFERENCES "public"."filament_colors"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "filament_spools" ADD CONSTRAINT "filament_spools_ref_id_filament_refs_id_fk" FOREIGN KEY ("ref_id") REFERENCES "public"."filament_refs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "filament_spools" ADD CONSTRAINT "filament_spools_purchase_id_filament_purchases_id_fk" FOREIGN KEY ("purchase_id") REFERENCES "public"."filament_purchases"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "filament_spools" ADD CONSTRAINT "filament_spools_holder_id_filament_holders_id_fk" FOREIGN KEY ("holder_id") REFERENCES "public"."filament_holders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "filament_movements_spool_idx" ON "filament_movements" USING btree ("spool_id","created_at");--> statement-breakpoint
CREATE INDEX "filament_movements_order_idx" ON "filament_movements" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "filament_movements_quote_idx" ON "filament_movements" USING btree ("quote_id");--> statement-breakpoint
CREATE INDEX "filament_movements_kind_idx" ON "filament_movements" USING btree ("kind","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "filament_refs_identity_unique" ON "filament_refs" USING btree ("brand","range_name","official_name");--> statement-breakpoint
CREATE INDEX "filament_spools_ref_status_idx" ON "filament_spools" USING btree ("ref_id","status");