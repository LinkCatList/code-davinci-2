DELETE FROM snippets
WHERE id IN (
  SELECT id FROM (
    SELECT s.id
    FROM snippets s
    WHERE EXISTS (
      SELECT 1
      FROM snippets keep
      WHERE keep.user_id = s.user_id
        AND (
          keep.position < s.position
          OR (keep.position = s.position AND keep.id < s.id)
        )
    )
  )
);--> statement-breakpoint
CREATE UNIQUE INDEX `snippets_user_id_unique` ON `snippets` (`user_id`);