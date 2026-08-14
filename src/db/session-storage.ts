import type { StorageAdapter } from "grammy";

export function d1SessionStorage(db: D1Database): StorageAdapter<unknown> {
  return {
    async read(key) {
      const row = await db
        .prepare("SELECT value FROM sessions WHERE key = ?")
        .bind(key)
        .first<{ value: string }>();
      if (!row) return undefined;
      return JSON.parse(row.value) as unknown;
    },
    async write(key, value) {
      await db
        .prepare(
          "INSERT INTO sessions (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        )
        .bind(key, JSON.stringify(value))
        .run();
    },
    async delete(key) {
      await db.prepare("DELETE FROM sessions WHERE key = ?").bind(key).run();
    },
  };
}
