CREATE TABLE `newsletter_sends` (
	`id` text PRIMARY KEY NOT NULL,
	`subject` text NOT NULL,
	`body_html` text NOT NULL,
	`audience` text NOT NULL,
	`product_id` text,
	`recipient_count` integer NOT NULL,
	`sent_by` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`sent_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
