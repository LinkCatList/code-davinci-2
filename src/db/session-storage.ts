import type { VersionedState } from "@grammyjs/conversations";

export function d1SessionStorage<S>(db: D1Database) {
  return {
    async read(key: string): Promise<VersionedState<S> | undefined> {
      const row = await db
        .prepare("SELECT value FROM sessions WHERE key = ?")
        .bind(key)
        .first<{ value: string }>();
      if (!row) return undefined;
      return JSON.parse(row.value) as VersionedState<S>;
    },
    async write(key: string, value: VersionedState<S>): Promise<void> {
      await db
        .prepare(
          "INSERT INTO sessions (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        )
        .bind(key, JSON.stringify(value))
        .run();
    },
    async delete(key: string): Promise<void> {
      await db.prepare("DELETE FROM sessions WHERE key = ?").bind(key).run();
    },
  };
}
