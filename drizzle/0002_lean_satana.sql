CREATE TABLE `customer_addresses` (
	`user_id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`street` text NOT NULL,
	`npa` text NOT NULL,
	`city` text NOT NULL,
	`canton` text DEFAULT '' NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
