CREATE TABLE `abandoned_carts` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`token` text NOT NULL,
	`items_json` text NOT NULL,
	`subtotal_cents` integer NOT NULL,
	`locale` text DEFAULT 'fr' NOT NULL,
	`consent_at` integer NOT NULL,
	`reminder_sent_at` integer,
	`recovered_at` integer,
	`unsubscribed_at` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `abandoned_carts_token_unique` ON `abandoned_carts` (`token`);--> statement-breakpoint
CREATE INDEX `abandoned_carts_email_idx` ON `abandoned_carts` (`email`);