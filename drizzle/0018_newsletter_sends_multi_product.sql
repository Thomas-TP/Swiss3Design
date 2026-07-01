-- Remplace le produit unique (product_id) par un tableau JSON de produits,
-- et ajoute bannière + CTA personnalisé au composeur newsletter.
ALTER TABLE `newsletter_sends` DROP COLUMN `product_id`;--> statement-breakpoint
ALTER TABLE `newsletter_sends` ADD `product_ids` text;--> statement-breakpoint
ALTER TABLE `newsletter_sends` ADD `banner_image_url` text;--> statement-breakpoint
ALTER TABLE `newsletter_sends` ADD `cta_label` text;--> statement-breakpoint
ALTER TABLE `newsletter_sends` ADD `cta_url` text;
