ALTER TABLE users ADD COLUMN is_premium integer NOT NULL DEFAULT 0;
--> statement-breakpoint
CREATE TABLE priority_invites (
  id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  from_user integer NOT NULL,
  to_user integer NOT NULL,
  created_at integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX priority_invites_pair_unique ON priority_invites (from_user, to_user);
