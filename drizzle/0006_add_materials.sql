CREATE TABLE `materials` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `materials_name_unique` ON `materials` (`name`);--> statement-breakpoint
INSERT OR IGNORE INTO `materials` (`id`, `name`) VALUES
	(lower(hex(randomblob(16))), 'PLA'),
	(lower(hex(randomblob(16))), 'PETG'),
	(lower(hex(randomblob(16))), 'PLA-CF'),
	(lower(hex(randomblob(16))), 'TPU');--> statement-breakpoint
INSERT OR IGNORE INTO `materials` (`id`, `name`)
SELECT lower(hex(randomblob(16))), `material`
FROM (SELECT DISTINCT `material` FROM `products` WHERE `material` IS NOT NULL AND trim(`material`) != '');