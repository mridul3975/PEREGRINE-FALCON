CREATE TABLE `refresh_tokens` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`token` text NOT NULL,
	`expires_at` text NOT NULL,
	`is_revoked` integer DEFAULT 0 NOT NULL,
	`replaced_by` text
);
