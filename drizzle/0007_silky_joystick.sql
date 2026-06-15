CREATE TABLE `quote_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`quote_id` text NOT NULL,
	`sender` text NOT NULL,
	`body` text NOT NULL,
	`price_cents` integer,
	`file_url` text,
	`file_name` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`quote_id`) REFERENCES `quote_requests`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `quote_messages_quote_idx` ON `quote_messages` (`quote_id`);--> statement-breakpoint
ALTER TABLE `quote_requests` ADD `valid_until` integer;