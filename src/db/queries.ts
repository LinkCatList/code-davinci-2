import { and, asc, eq } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { now } from "../now";
import { localeFromTelegram, type Locale } from "../t";
import * as schema from "./schema";
import { events, snippets, users } from "./schema";

export type Db = DrizzleD1Database<typeof schema>;

export type UserRecord = typeof users.$inferSelect;
export type SnippetRecord = typeof snippets.$inferSelect;
export type EventType = "onboarding_start" | "profile_complete";

export async function upsertUser(
  db: Db,
  from: { id: number; username?: string; language_code?: string },
): Promise<{ locale: Locale }> {
  const ts = now();
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

export async function getUser(db: Db, id: number): Promise<UserRecord | null> {
  const row = await db.select().from(users).where(eq(users.id, id)).get();
  return row ?? null;
}

export async function patchUser(
  db: Db,
  id: number,
  patch: Partial<typeof users.$inferInsert>,
): Promise<void> {
  await db.update(users).set(patch).where(eq(users.id, id));
}

export async function listSnippets(db: Db, userId: number): Promise<SnippetRecord[]> {
  return db
    .select()
    .from(snippets)
    .where(eq(snippets.userId, userId))
    .orderBy(asc(snippets.position))
    .all();
}

export async function insertSnippet(
  db: Db,
  values: { userId: number; language: string; content: string; position: number },
): Promise<void> {
  await db.insert(snippets).values(values);
}

export async function clearOnboardingFields(db: Db, userId: number): Promise<void> {
  await db
    .update(users)
    .set({
      name: null,
      birthYear: null,
      gender: null,
      bio: null,
      city: null,
      lat: null,
      lng: null,
      state: "onboarding:name",
    })
    .where(eq(users.id, userId));
  await db.delete(snippets).where(eq(snippets.userId, userId));
}

export async function completeProfile(db: Db, userId: number): Promise<void> {
  await db.update(users).set({ state: null }).where(eq(users.id, userId));
  await insertEventOnce(db, userId, "profile_complete");
}

export async function hasEvent(db: Db, userId: number, type: EventType): Promise<boolean> {
  const row = await db
    .select({ id: events.id })
    .from(events)
    .where(and(eq(events.userId, userId), eq(events.type, type)))
    .get();
  return row !== undefined;
}

export async function insertEventOnce(db: Db, userId: number, type: EventType): Promise<void> {
  if (await hasEvent(db, userId, type)) return;
  await db.insert(events).values({ userId, type, createdAt: now() });
}

export async function deleteSnippet(
  db: Db,
  userId: number,
  snippetId: number,
): Promise<"ok" | "last" | "missing"> {
  const all = await listSnippets(db, userId);
  if (all.length <= 1) return "last";
  const target = all.find((row) => row.id === snippetId);
  if (!target) return "missing";
  await db
    .delete(snippets)
    .where(and(eq(snippets.id, snippetId), eq(snippets.userId, userId)));
  const remaining = await listSnippets(db, userId);
  for (const [index, row] of remaining.entries()) {
    if (row.position !== index) {
      await db.update(snippets).set({ position: index }).where(eq(snippets.id, row.id));
    }
  }
  return "ok";
}

export function isOnboarding(user: UserRecord): boolean {
  return user.state !== null;
}

export function isProfileComplete(
  user: UserRecord,
  snippetCount: number,
): boolean {
  return (
    user.state === null &&
    user.name !== null &&
    user.birthYear !== null &&
    user.gender !== null &&
    snippetCount > 0
  );
}
