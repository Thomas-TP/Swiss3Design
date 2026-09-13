CREATE INDEX "orders_pending_expiry_idx" ON "orders" USING btree ("status","reservation_expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_payment_intent_unique" ON "orders" USING btree ("stripe_payment_intent_id");--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_quantity_positive" CHECK ("order_items"."quantity" > 0);--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_price_nonnegative" CHECK ("order_items"."price_cents_snapshot" >= 0);--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_amounts_valid" CHECK ("orders"."subtotal_cents" >= 0 AND "orders"."shipping_cents" >= 0 AND "orders"."discount_cents" >= 0 AND "orders"."discount_cents" <= "orders"."subtotal_cents" AND "orders"."total_cents" = "orders"."subtotal_cents" + "orders"."shipping_cents" - "orders"."discount_cents" AND "orders"."refunded_cents" >= 0 AND "orders"."refunded_cents" <= "orders"."total_cents");--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_status_valid" CHECK ("orders"."status" IN ('pending','paid','in_production','shipped','delivered','cancelled'));--> statement-breakpoint
ALTER TABLE "product_variants" ADD CONSTRAINT "variants_stock_nonnegative" CHECK ("product_variants"."stock" >= 0);--> statement-breakpoint
ALTER TABLE "product_variants" ADD CONSTRAINT "variants_price_nonnegative" CHECK ("product_variants"."price_cents" >= 0);--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_price_nonnegative" CHECK ("products"."price_cents" >= 0);--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_stock_nonnegative" CHECK ("products"."stock" >= 0);