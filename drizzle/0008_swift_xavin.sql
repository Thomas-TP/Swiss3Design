CREATE TABLE `filament_colors` (
	`id` text PRIMARY KEY NOT NULL,
	`material_id` text NOT NULL,
	`name` text NOT NULL,
	`hex` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`material_id`) REFERENCES `materials`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `filament_colors_material_idx` ON `filament_colors` (`material_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `filament_colors_material_name_unique` ON `filament_colors` (`material_id`,`name`);--> statement-breakpoint
CREATE TABLE `product_colors` (
	`product_id` text NOT NULL,
	`color_id` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`product_id`, `color_id`),
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`color_id`) REFERENCES `filament_colors`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `product_colors_product_idx` ON `product_colors` (`product_id`);--> statement-breakpoint
ALTER TABLE `order_items` ADD `color_name` text;--> statement-breakpoint
ALTER TABLE `order_items` ADD `color_hex` text;--> statement-breakpoint
INSERT OR IGNORE INTO `filament_colors` (`id`, `material_id`, `name`, `hex`, `sort_order`)
SELECT lower(hex(randomblob(16))), m.`id`, c.`name`, c.`hex`, c.`sort_order`
FROM `materials` m
JOIN (
	SELECT 'Noir' AS name, '#1C1917' AS hex, 0 AS sort_order
	UNION ALL SELECT 'Blanc', '#F5F5F4', 1
	UNION ALL SELECT 'Rouge', '#E5231C', 2
	UNION ALL SELECT 'Gris', '#6B7280', 3
	UNION ALL SELECT 'Bleu', '#1D4ED8', 4
) c
WHERE m.`name` IN ('PLA', 'PETG');