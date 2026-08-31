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
  menuLegend,
  parseBrowseMode,
  pausedKeyboard,
  profileKeyboard,
  withMenuLegend,
} from "../keyboards";
import { t, type Locale } from "../t";
import { renderOwnCard } from "./card";
import type { OutsideContext } from "./onboarding";

export function ownCardMessage(
  user: UserRecord,
  snippets: SnippetRecord[],
  nowMs: number,
  locale: Locale,
): { html: string; keyboard: ReturnType<typeof profileKeyboard> } {
  return {
    html: renderOwnCard({
      name: user.name ?? "",
      birthYear: user.birthYear ?? 0,
      bio: user.bio,
      gender: user.gender,
      locale,
      snippets,
      nowMs,
      includeAllSnippets: true,
      header: t(locale, "ownCardFrame"),
      footer: menuLegend("profile", locale),
    }),
    keyboard: profileKeyboard(locale),
  };
}

export async function replyHome(ctx: OutsideContext): Promise<void> {
  if (!ctx.from) return;
  await setBrowseState(ctx.db, ctx.from.id, "home", null);
  await ctx.reply(withMenuLegend(t(ctx.locale, "homeWait"), "home", ctx.locale), {
    reply_markup: homeKeyboard(ctx.locale),
  });
}

export async function replyProfileScreen(ctx: OutsideContext): Promise<void> {
  if (!ctx.from) return;
  const user = await getUser(ctx.db, ctx.from.id);
  if (!user || user.name === null || user.birthYear === null) return;
  const snippets = await listSnippets(ctx.db, user.id);
  await setBrowseState(ctx.db, user.id, "profile", null);
  const { html, keyboard } = ownCardMessage(user, snippets, Date.now(), ctx.locale);
  await ctx.reply(html, { parse_mode: "HTML", reply_markup: keyboard });
}

export async function replyPaused(ctx: OutsideContext): Promise<void> {
  if (!ctx.from) return;
  await setBrowseState(ctx.db, ctx.from.id, "paused", null);
  await ctx.reply(withMenuLegend(t(ctx.locale, "pausedHint"), "paused", ctx.locale), {
    reply_markup: pausedKeyboard(ctx.locale),
  });
}

export function isPausedUser(user: UserRecord): boolean {
  return user.isActive !== 1 && !isOnboarding(user);
}

export { parseBrowseMode };
