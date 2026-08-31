DELETE FROM sessions
WHERE `key` IN (
  SELECT CAST(id AS TEXT)
  FROM users
  WHERE state = 'onboarding:location'
);--> statement-breakpoint
DELETE FROM snippets
WHERE user_id IN (
  SELECT id
  FROM users
  WHERE state = 'onboarding:location'
);--> statement-breakpoint
UPDATE users
SET
  name = NULL,
  birth_year = NULL,
  gender = NULL,
  bio = NULL,
  state = 'onboarding:lang',
  last_card_user_id = NULL,
  browse_mode = NULL
WHERE state = 'onboarding:location';--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `city`;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `lat`;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `lng`;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `max_dist_km`;
