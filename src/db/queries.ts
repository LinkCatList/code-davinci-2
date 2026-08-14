import { eq } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { localeFromTelegram, type Locale } from "../t";
import * as schema from "./schema";
import { users } from "./schema";

export type Db = DrizzleD1Database<typeof schema>;

export async function upsertUser(
  db: Db,
  from: { id: number; username?: string; language_code?: string },
): Promise<{ locale: Locale }> {
  const ts = Math.floor(Date.now() / 1000);
  const locale = localeFromTelegram(from.language_code);
  const existing = await db
    .select({ locale: users.locale })
    .from(users)
    .where(eq(users.id, from.id))
    .get();

  if (existing) {
    await db
      .update(users)
      .set({
        username: from.username ?? null,
        lastActiveAt: ts,
        isActive: 1,
      })
      .where(eq(users.id, from.id));
    return { locale: existing.locale === "ru" ? "ru" : "en" };
  }

  await db.insert(users).values({
    id: from.id,
    username: from.username ?? null,
    locale,
    state: "onboarding",
    isActive: 1,
    lastActiveAt: ts,
    createdAt: ts,
  });
  return { locale };
}
