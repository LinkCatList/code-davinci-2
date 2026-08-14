import { InlineKeyboard, type Context } from "grammy";
import { countIncomingLikes, deleteSnippet, getUser, isOnboarding, listSnippets } from "../db/queries";
import { renderOwnCard } from "./card";
import {
  askBio,
  askGender,
  askLocation,
  askName,
  askSnippetLanguage,
  askSnippetText,
  askYear,
  type BotConversation,
  loadSnippets,
  saveSnippet,
  waitUpdate,
  type OutsideContext,
} from "./onboarding";
import { t, type Locale } from "../t";

const EDIT_FIELDS = ["name", "year", "gender", "bio", "loc", "snippets"] as const;
type EditField = (typeof EDIT_FIELDS)[number];

function isEditField(value: string): value is EditField {
  return (EDIT_FIELDS as readonly string[]).includes(value);
}

function editKeyboard(locale: Locale, likesCount: number): InlineKeyboard {
  return new InlineKeyboard()
    .text(t(locale, "likesButton", { n: likesCount }), "lk:open")
    .row()
    .text(t(locale, "editName"), "pf:name")
    .text(t(locale, "editYear"), "pf:year")
    .row()
    .text(t(locale, "editGender"), "pf:gender")
    .text(t(locale, "editBio"), "pf:bio")
    .row()
    .text(t(locale, "editLocation"), "pf:loc")
    .row()
    .text(t(locale, "editSnippets"), "pf:snippets");
}

export async function replyProfile(ctx: OutsideContext): Promise<void> {
  if (!ctx.from) return;
  const user = await getUser(ctx.db, ctx.from.id);
  if (!user || user.name === null || user.birthYear === null) return;
  const snippets = await listSnippets(ctx.db, user.id);
  const likesCount = await countIncomingLikes(ctx.db, user.id);
  await ctx.reply(
    renderOwnCard({
      name: user.name,
      birthYear: user.birthYear,
      bio: user.bio,
      city: user.city,
      snippets,
      nowMs: Date.now(),
      includeAllSnippets: true,
      footer: t(ctx.locale, "profileEditHint"),
    }),
    { parse_mode: "HTML", reply_markup: editKeyboard(ctx.locale, likesCount) },
  );
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
    const likesCount = await countIncomingLikes(outer.db, user.id);
    return { user, snippets, likesCount };
  });
  if (!data) return;
  await ctx.reply(
    renderOwnCard({
      name: data.user.name ?? "",
      birthYear: data.user.birthYear ?? 0,
      bio: data.user.bio,
      city: data.user.city,
      snippets: data.snippets,
      nowMs,
      includeAllSnippets: true,
      footer: t(locale, "profileEditHint"),
    }),
    { parse_mode: "HTML", reply_markup: editKeyboard(locale, data.likesCount) },
  );
}

async function editSnippets(
  conversation: BotConversation,
  ctx: Context,
  locale: Locale,
  cancelText: string,
): Promise<void> {
  for (;;) {
    const snippets = await loadSnippets(conversation);
    const keyboard = new InlineKeyboard();
    for (const [index, snippet] of snippets.entries()) {
      keyboard.text(`${index + 1}. ${snippet.language}`, `pf:sdel:${snippet.id}`).row();
    }
    if (snippets.length < 3) {
      keyboard.text(t(locale, "onboardingSnippetAdd"), "pf:sadd").row();
    }
    keyboard.text(t(locale, "editSnippetDone"), "pf:sdone");

    const send = (target: Context) =>
      target.reply(t(locale, "editSnippetsTitle"), { reply_markup: keyboard });
    await send(ctx);

    const next = await waitUpdate(conversation, send, cancelText);
    const data = next.callbackQuery?.data;
    if (data === "pf:sdone") {
      ctx = next;
      return;
    }
    if (data === "pf:sadd") {
      const content = await askSnippetText(conversation, next, locale, cancelText);
      const language = await askSnippetLanguage(conversation, next, locale, cancelText);
      await saveSnippet(conversation, content, language, snippets.length);
      ctx = next;
      continue;
    }
    if (data?.startsWith("pf:sdel:")) {
      const id = Number(data.slice("pf:sdel:".length));
      const result = await conversation.external(async (outer) => {
        if (!outer.from) return "missing" as const;
        return deleteSnippet(outer.db, outer.from.id, id);
      });
      if (result === "last") {
        await next.reply(t(locale, "editSnippetLast"));
      }
      ctx = next;
      continue;
    }
    ctx = next;
  }
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
  if (!ctx.from) return;
  const user = await getUser(ctx.db, ctx.from.id);
  if (!user || isOnboarding(user)) {
    await ctx.reply(t(ctx.locale, "finishOnboardingFirst"));
    return;
  }
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
  const field = data.slice("pf:".length);
  if (!isEditField(field)) return;
  if (ctx.conversation.active("editProfile") > 0) return;
  await ctx.conversation.enter("editProfile", field);
}
