CREATE TABLE "order_item_filaments" (
	"order_item_id" text PRIMARY KEY NOT NULL,
	"ref_id" text NOT NULL,
	"grams_per_piece" integer NOT NULL,
	CONSTRAINT "order_item_filaments_grams_positive" CHECK ("order_item_filaments"."grams_per_piece" > 0)
);
--> statement-breakpoint
CREATE TABLE "product_filament_exclusions" (
	"product_id" text NOT NULL,
	"ref_id" text NOT NULL,
	CONSTRAINT "product_filament_exclusions_product_id_ref_id_pk" PRIMARY KEY("product_id","ref_id")
);
--> statement-breakpoint
ALTER TABLE "order_item_filaments" ADD CONSTRAINT "order_item_filaments_order_item_id_order_items_id_fk" FOREIGN KEY ("order_item_id") REFERENCES "public"."order_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_item_filaments" ADD CONSTRAINT "order_item_filaments_ref_id_filament_refs_id_fk" FOREIGN KEY ("ref_id") REFERENCES "public"."filament_refs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_filament_exclusions" ADD CONSTRAINT "product_filament_exclusions_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_filament_exclusions" ADD CONSTRAINT "product_filament_exclusions_ref_id_filament_refs_id_fk" FOREIGN KEY ("ref_id") REFERENCES "public"."filament_refs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "order_item_filaments_ref_idx" ON "order_item_filaments" USING btree ("ref_id");--> statement-breakpoint
CREATE INDEX "product_filament_exclusions_ref_idx" ON "product_filament_exclusions" USING btree ("ref_id");