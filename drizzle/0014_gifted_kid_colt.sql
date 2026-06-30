PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_customer_addresses` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`label` text,
	`name` text NOT NULL,
	`street` text NOT NULL,
	`npa` text NOT NULL,
	`city` text NOT NULL,
	`canton` text DEFAULT '' NOT NULL,
	`is_default` integer DEFAULT false NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
-- Chaque adresse existante (une par client, sans id ni label ni is_default
-- dans l'ancien schéma) devient l'adresse PAR DÉFAUT du même client dans le
-- nouveau carnet d'adresses. id généré en SQL (pas d'app layer dans une
-- migration) ; label NULL (rien à mapper) ; is_default = 1 pour toutes.
INSERT INTO `__new_customer_addresses` ("id", "user_id", "label", "name", "street", "npa", "city", "canton", "is_default", "updated_at")
SELECT lower(hex(randomblob(16))), "user_id", NULL, "name", "street", "npa", "city", "canton", 1, "updated_at" FROM `customer_addresses`;--> statement-breakpoint
DROP TABLE `customer_addresses`;--> statement-breakpoint
ALTER TABLE `__new_customer_addresses` RENAME TO `customer_addresses`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `customer_addresses_user_idx` ON `customer_addresses` (`user_id`);
