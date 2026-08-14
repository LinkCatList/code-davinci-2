import {
  getUser,
  isOnboarding,
  listSnippets,
  setBrowseState,
  type SnippetRecord,
  type UserRecord,
} from "../db/queries";
import {
  homeKeyboard,
  parseBrowseMode,
  pausedKeyboard,
  profileKeyboard,
} from "../keyboards";
import { t, type Locale } from "../t";
import { renderOwnCard } from "./card";
import type { OutsideContext } from "./onboarding";

export function ownCardMessage(
  user: UserRecord,
  snippets: SnippetRecord[],
  nowMs: number,
  locale: Locale,
  screen: "home" | "profile",
): { html: string; keyboard: ReturnType<typeof homeKeyboard> } {
  return {
    html: renderOwnCard({
      name: user.name ?? "",
      birthYear: user.birthYear ?? 0,
      bio: user.bio,
      city: user.city,
      snippets,
      nowMs,
      includeAllSnippets: true,
      header: t(locale, "ownCardFrame"),
    }),
    keyboard: screen === "profile" ? profileKeyboard(locale) : homeKeyboard(locale),
  };
}

export async function replyOwnCard(
  ctx: OutsideContext,
  screen: "home" | "profile",
): Promise<void> {
  if (!ctx.from) return;
  const user = await getUser(ctx.db, ctx.from.id);
  if (!user || user.name === null || user.birthYear === null) return;
  const snippets = await listSnippets(ctx.db, user.id);
  await setBrowseState(ctx.db, user.id, screen, null);
  const { html, keyboard } = ownCardMessage(user, snippets, Date.now(), ctx.locale, screen);
  await ctx.reply(html, { parse_mode: "HTML", reply_markup: keyboard });
}

export async function replyHome(ctx: OutsideContext): Promise<void> {
  await replyOwnCard(ctx, "home");
}

export async function replyProfileScreen(ctx: OutsideContext): Promise<void> {
  await replyOwnCard(ctx, "profile");
}

export async function replyPaused(ctx: OutsideContext): Promise<void> {
  if (!ctx.from) return;
  await setBrowseState(ctx.db, ctx.from.id, "paused", null);
  await ctx.reply(t(ctx.locale, "pausedHint"), { reply_markup: pausedKeyboard(ctx.locale) });
}

export function isPausedUser(user: UserRecord): boolean {
  return user.isActive !== 1 && !isOnboarding(user);
}

export { parseBrowseMode };
