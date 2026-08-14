CREATE TABLE `events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer,
	`type` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `likes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`from_user` integer NOT NULL,
	`to_user` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `likes_from_to_unique` ON `likes` (`from_user`,`to_user`);--> statement-breakpoint
CREATE TABLE `matches` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_a` integer NOT NULL,
	`user_b` integer NOT NULL,
	`revealed_a` integer DEFAULT 0 NOT NULL,
	`revealed_b` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `matches_pair_unique` ON `matches` (`user_a`,`user_b`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `skips` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`from_user` integer NOT NULL,
	`to_user` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `skips_from_to_unique` ON `skips` (`from_user`,`to_user`);--> statement-breakpoint
CREATE TABLE `snippets` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`language` text NOT NULL,
	`content` text NOT NULL,
	`position` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY NOT NULL,
	`username` text,
	`locale` text NOT NULL,
	`state` text,
	`name` text,
	`birth_year` integer,
	`gender` integer,
	`bio` text,
	`photo_file_id` text,
	`city` text,
	`lat` real,
	`lng` real,
	`max_dist_km` integer,
	`lang_filter` text,
	`is_active` integer DEFAULT 1 NOT NULL,
	`is_fake` integer DEFAULT 0 NOT NULL,
	`last_active_at` integer NOT NULL,
	`last_like_notif_at` integer,
	`created_at` integer NOT NULL
);
