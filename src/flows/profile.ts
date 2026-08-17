import { type Context } from "grammy";
import { getUser, isOnboarding, listSnippets, setBrowseState } from "../db/queries";
import { t, type Locale } from "../t";
import {
  askBio,
  askGender,
  askLocation,
  askName,
  askSnippetLanguage,
  askSnippetText,
  askYear,
  type BotConversation,
  saveSnippet,
  type OutsideContext,
} from "./onboarding";
import { ownCardMessage, isPausedUser, replyPaused, replyProfileScreen } from "./screens";

const EDIT_FIELDS = ["name", "year", "gender", "bio", "loc", "snippets"] as const;
type EditField = (typeof EDIT_FIELDS)[number];

function isEditField(value: string): value is EditField {
  return (EDIT_FIELDS as readonly string[]).includes(value);
}

export async function replyProfile(ctx: OutsideContext): Promise<void> {
  if (!ctx.from) return;
  const user = await getUser(ctx.db, ctx.from.id);
  if (!user || isOnboarding(user)) {
    await ctx.reply(t(ctx.locale, "finishOnboardingFirst"));
    return;
  }
  if (isPausedUser(user)) {
    await replyPaused(ctx);
    return;
  }
  await replyProfileScreen(ctx);
}

async function replyProfileFromConversation(
  conversation: BotConversation,
  ctx: Context,
  locale: Locale,
): Promise<void> {
  const nowMs = await conversation.now();
  const data = await conversation.external(async (outer) => {
    if (!outer.from) return null;
    const user = await getUser(outer.db, outer.from.id);
    if (!user || user.name === null || user.birthYear === null) return null;
    const snippets = await listSnippets(outer.db, user.id);
    await setBrowseState(outer.db, user.id, "profile", null);
    return { user, snippets };
  });
  if (!data) return;
  const { html, keyboard } = ownCardMessage(data.user, data.snippets, nowMs, locale);
  await ctx.reply(html, { parse_mode: "HTML", reply_markup: keyboard });
}

async function editSnippets(
  conversation: BotConversation,
  ctx: Context,
  locale: Locale,
  cancelText: string,
): Promise<void> {
  const { content, language: detected } = await askSnippetText(conversation, ctx, locale, cancelText);
  const language = detected ?? (await askSnippetLanguage(conversation, ctx, locale, cancelText));
  await saveSnippet(conversation, content, language);
}

export async function editProfile(
  conversation: BotConversation,
  ctx: Context,
  field: string,
): Promise<void> {
  const locale = await conversation.external((outer) => outer.locale);
  const cancelText = t(locale, "editCancelled");
  if (!isEditField(field)) {
    await replyProfileFromConversation(conversation, ctx, locale);
    return;
  }

  switch (field) {
    case "name":
      await askName(conversation, ctx, locale, cancelText);
      break;
    case "year":
      await askYear(conversation, ctx, locale, cancelText);
      break;
    case "gender":
      await askGender(conversation, ctx, locale, cancelText);
      break;
    case "bio":
      await askBio(conversation, ctx, locale, cancelText);
      break;
    case "loc":
      await askLocation(conversation, ctx, locale, cancelText);
      break;
    case "snippets":
      await editSnippets(conversation, ctx, locale, cancelText);
      break;
  }

  await replyProfileFromConversation(conversation, ctx, locale);
}

export async function handleProfileCommand(ctx: OutsideContext): Promise<void> {
  await replyProfile(ctx);
}

export async function handleProfileCallback(ctx: OutsideContext): Promise<void> {
  const data = ctx.callbackQuery?.data;
  if (!data?.startsWith("pf:")) return;
  if (ctx.callbackQuery) {
    try {
      await ctx.answerCallbackQuery();
    } catch {
      // already answered
    }
  }
  if (!ctx.from) return;
  const user = await getUser(ctx.db, ctx.from.id);
  if (!user || isOnboarding(user)) {
    await ctx.reply(t(ctx.locale, "finishOnboardingFirst"));
    return;
  }
  if (isPausedUser(user)) {
    await replyPaused(ctx);
    return;
  }
  const field = data.slice("pf:".length);
  if (!isEditField(field)) return;
  if (ctx.conversation.active("editProfile") > 0) return;
  await ctx.conversation.enter("editProfile", field);
}

export async function startProfileEdit(ctx: OutsideContext, field: "bio" | "snippets"): Promise<void> {
  if (!ctx.from) return;
  const user = await getUser(ctx.db, ctx.from.id);
  if (!user || isOnboarding(user)) {
    await ctx.reply(t(ctx.locale, "finishOnboardingFirst"));
    return;
  }
  if (isPausedUser(user)) {
    await replyPaused(ctx);
    return;
  }
  if (ctx.conversation.active("editProfile") > 0) return;
  await ctx.conversation.enter("editProfile", field);
}
