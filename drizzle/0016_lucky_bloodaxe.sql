CREATE TABLE `notification_preferences` (
	`user_id` text PRIMARY KEY NOT NULL,
	`newsletter` integer DEFAULT false NOT NULL,
	`product_news` integer DEFAULT false NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
