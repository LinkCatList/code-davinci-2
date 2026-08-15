import {
  type Conversation,
  type ConversationFlavor,
} from "@grammyjs/conversations";
import { InlineKeyboard, type Context } from "grammy";
import {
  clearOnboardingFields,
  completeProfile,
  getUser,
  insertEventOnce,
  insertSnippet,
  isOnboarding,
  listSnippets,
  patchUser,
  setBrowseState,
  type SnippetRecord,
  type UserRecord,
} from "../db/queries";
import {
  isReservedInput,
  isSkipText,
  matchGenderButton,
  matchLangButton,
  matchPreviewButton,
  matchSnippetMoreButton,
  onboardingGenderKeyboard,
  onboardingLangKeyboard,
  onboardingLocationKeyboard,
  onboardingMoreKeyboard,
  onboardingPreviewKeyboard,
  onboardingSkipKeyboard,
  profileKeyboard,
  REMOVE_KEYBOARD,
} from "../keyboards";
import { detectSnippetLanguage, isSnippetLanguage, SNIPPET_LANGUAGES } from "../snippet-languages";
import { t, type Locale } from "../t";
import { renderOwnCard } from "./card";
import { replyNextFeedCard } from "./feed";

export type OutsideContext = ConversationFlavor<
  Context & {
    db: import("../db/queries").Db;
    executionCtx: ExecutionContext;
    locale: Locale;
  }
>;

export type BotConversation = Conversation<OutsideContext, Context>;
type OnboardingConversation = BotConversation;

const STEPS = [
  "onboarding:lang",
  "onboarding:name",
  "onboarding:year",
  "onboarding:gender",
  "onboarding:bio",
  "onboarding:location",
  "onboarding:snippets",
  "onboarding:preview",
] as const;

type OnboardingStep = (typeof STEPS)[number];

function normalizeStep(state: string | null): OnboardingStep {
  if (state === "onboarding" || state === null) return "onboarding:lang";
  if (state === "onboarding:photo") return "onboarding:snippets";
  if ((STEPS as readonly string[]).includes(state)) return state as OnboardingStep;
  return "onboarding:lang";
}

function commandName(ctx: Context): string | undefined {
  const raw = ctx.message?.text;
  if (!raw?.startsWith("/")) return undefined;
  const name = raw.slice(1).split(/[\s@]/)[0];
  return name?.toLowerCase() || undefined;
}

async function dropMarkup(ctx: Context): Promise<void> {
  try {
    await ctx.editMessageReplyMarkup({ reply_markup: { inline_keyboard: [] } });
  } catch {
    // message may be gone or have no markup
  }
}

async function ackCallback(ctx: Context): Promise<void> {
  if (!ctx.callbackQuery) return;
  try {
    await ctx.answerCallbackQuery();
  } catch {
    // already answered or expired
  }
}

async function cancelMarkup(
  conversation: OnboardingConversation,
): Promise<typeof REMOVE_KEYBOARD | ReturnType<typeof profileKeyboard>> {
  return conversation.external(async (outer) => {
    if (!outer.from) return REMOVE_KEYBOARD;
    const user = await getUser(outer.db, outer.from.id);
    if (user && !isOnboarding(user)) {
      await setBrowseState(outer.db, user.id, "profile", null);
      return profileKeyboard(outer.locale);
    }
    return REMOVE_KEYBOARD;
  });
}

async function handleMeta(
  conversation: OnboardingConversation,
  ctx: Context,
  reprompt: () => Promise<unknown>,
  cancelText: string,
): Promise<boolean> {
  const cmd = commandName(ctx);
  if (cmd === "start") {
    await reprompt();
    return true;
  }
  if (cmd === "cancel") {
    await ctx.reply(cancelText, { reply_markup: await cancelMarkup(conversation) });
    await conversation.halt();
  }
  if (cmd) {
    await conversation.halt({ next: true });
  }
  return false;
}

export async function waitUpdate(
  conversation: OnboardingConversation,
  send: (ctx: Context) => Promise<unknown>,
  cancelText: string,
): Promise<Context> {
  for (;;) {
    const next = await conversation.wait();
    await ackCallback(next);
    if (await handleMeta(conversation, next, () => send(next), cancelText)) continue;
    return next;
  }
}

export async function loadUser(conversation: OnboardingConversation): Promise<UserRecord | null> {
  return conversation.external(async (outer) => {
    if (!outer.from) return null;
    return getUser(outer.db, outer.from.id);
  });
}

export async function loadSnippets(conversation: OnboardingConversation): Promise<SnippetRecord[]> {
  return conversation.external(async (outer) => {
    if (!outer.from) return [];
    return listSnippets(outer.db, outer.from.id);
  });
}

async function saveUser(
  conversation: OnboardingConversation,
  patch: Parameters<typeof patchUser>[2],
): Promise<void> {
  await conversation.external(async (outer) => {
    if (!outer.from) return;
    await patchUser(outer.db, outer.from.id, patch);
  });
}

async function setStep(conversation: OnboardingConversation, state: OnboardingStep): Promise<void> {
  await saveUser(conversation, { state });
}

function localeOf(user: UserRecord): Locale {
  return user.locale === "ru" ? "ru" : "en";
}

function snippetLangKeyboard(): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  SNIPPET_LANGUAGES.forEach((language, index) => {
    keyboard.text(language, `ob:slang:${language}`);
    if ((index + 1) % 3 === 0) keyboard.row();
  });
  return keyboard;
}

async function askLanguage(
  conversation: OnboardingConversation,
  ctx: Context,
  locale: Locale,
): Promise<Locale> {
  const send = async (target: Context) => {
    await target.reply(t(locale, "startWelcome"));
    await target.reply(t(locale, "onboardingLang"), { reply_markup: onboardingLangKeyboard(locale) });
  };
  await send(ctx);
  for (;;) {
    const next = await waitUpdate(conversation, send, t(locale, "onboardingCancelled"));
    const data = next.callbackQuery?.data;
    if (data === "ob:lang:ru" || data === "ob:lang:en") {
      const picked: Locale = data.endsWith("ru") ? "ru" : "en";
      await dropMarkup(next);
      await saveUser(conversation, { locale: picked });
      return picked;
    }
    const fromText = next.message?.text ? matchLangButton(next.message.text) : null;
    if (fromText) {
      await saveUser(conversation, { locale: fromText });
      return fromText;
    }
    await next.reply(t(locale, "onboardingLang"), { reply_markup: onboardingLangKeyboard(locale) });
  }
}

export async function askName(
  conversation: OnboardingConversation,
  ctx: Context,
  locale: Locale,
  cancelText?: string,
): Promise<void> {
  const stop = cancelText ?? t(locale, "onboardingCancelled");
  const send = (target: Context) =>
    target.reply(t(locale, "onboardingName"), { reply_markup: REMOVE_KEYBOARD });
  await send(ctx);
  for (;;) {
    const next = await waitUpdate(conversation, send, stop);
    const text = next.message?.text?.trim();
    if (text && isReservedInput(text)) {
      await next.reply(t(locale, "onboardingNameBad"), { reply_markup: REMOVE_KEYBOARD });
      continue;
    }
    if (text && text.length >= 1 && text.length <= 50) {
      await saveUser(conversation, { name: text });
      return;
    }
    await next.reply(t(locale, "onboardingNameBad"), { reply_markup: REMOVE_KEYBOARD });
  }
}

export async function askYear(
  conversation: OnboardingConversation,
  ctx: Context,
  locale: Locale,
  cancelText?: string,
): Promise<void> {
  const stop = cancelText ?? t(locale, "onboardingCancelled");
  const send = (target: Context) =>
    target.reply(t(locale, "onboardingYear"), { reply_markup: REMOVE_KEYBOARD });
  await send(ctx);
  for (;;) {
    const next = await waitUpdate(conversation, send, stop);
    const text = next.message?.text?.trim();
    if (!text || !/^\d{4}$/.test(text)) {
      await next.reply(t(locale, "onboardingYearBad"), { reply_markup: REMOVE_KEYBOARD });
      continue;
    }
    const year = Number(text);
    const nowMs = await conversation.now();
    const currentYear = new Date(nowMs).getUTCFullYear();
    if (year < currentYear - 120 || year > currentYear) {
      await next.reply(t(locale, "onboardingYearBad"), { reply_markup: REMOVE_KEYBOARD });
      continue;
    }
    await saveUser(conversation, { birthYear: year });
    return;
  }
}

export async function askGender(
  conversation: OnboardingConversation,
  ctx: Context,
  locale: Locale,
  cancelText?: string,
): Promise<void> {
  const stop = cancelText ?? t(locale, "onboardingCancelled");
  const send = (target: Context) =>
    target.reply(t(locale, "onboardingGender"), { reply_markup: onboardingGenderKeyboard(locale) });
  await send(ctx);
  for (;;) {
    const next = await waitUpdate(conversation, send, stop);
    const data = next.callbackQuery?.data;
    if (data === "ob:gender:0" || data === "ob:gender:1") {
      await dropMarkup(next);
      await saveUser(conversation, { gender: data.endsWith("1") ? 1 : 0 });
      return;
    }
    const fromText = next.message?.text ? matchGenderButton(next.message.text, locale) : null;
    if (fromText !== null) {
      await saveUser(conversation, { gender: fromText });
      return;
    }
    await next.reply(t(locale, "onboardingGenderBad"), {
      reply_markup: onboardingGenderKeyboard(locale),
    });
  }
}

export async function askBio(
  conversation: OnboardingConversation,
  ctx: Context,
  locale: Locale,
  cancelText?: string,
): Promise<void> {
  const stop = cancelText ?? t(locale, "onboardingCancelled");
  const send = (target: Context) =>
    target.reply(t(locale, "onboardingBio"), { reply_markup: onboardingSkipKeyboard(locale) });
  await send(ctx);
  for (;;) {
    const next = await waitUpdate(conversation, send, stop);
    if (next.callbackQuery?.data === "ob:skip:bio") {
      await dropMarkup(next);
      await saveUser(conversation, { bio: null });
      return;
    }
    const text = next.message?.text;
    if (text !== undefined) {
      if (isSkipText(text, locale)) {
        await saveUser(conversation, { bio: null });
        return;
      }
      if (isReservedInput(text)) {
        await next.reply(t(locale, "onboardingBioBad"), {
          reply_markup: onboardingSkipKeyboard(locale),
        });
        continue;
      }
      const trimmed = text.trim();
      if (trimmed.length === 0) {
        await saveUser(conversation, { bio: null });
        return;
      }
      if (trimmed.length > 300) {
        await next.reply(t(locale, "onboardingBioBad"), {
          reply_markup: onboardingSkipKeyboard(locale),
        });
        continue;
      }
      await saveUser(conversation, { bio: trimmed });
      return;
    }
    await next.reply(t(locale, "onboardingBioBad"), {
      reply_markup: onboardingSkipKeyboard(locale),
    });
  }
}

export async function askLocation(
  conversation: OnboardingConversation,
  ctx: Context,
  locale: Locale,
  cancelText?: string,
): Promise<void> {
  const stop = cancelText ?? t(locale, "onboardingCancelled");
  const send = (target: Context) =>
    target.reply(t(locale, "onboardingLocation"), {
      reply_markup: onboardingLocationKeyboard(locale),
    });
  await send(ctx);
  for (;;) {
    const next = await waitUpdate(conversation, send, stop);
    if (next.callbackQuery?.data === "ob:skip:loc") {
      await dropMarkup(next);
      await saveUser(conversation, { city: null, lat: null, lng: null });
      return;
    }
    const location = next.message?.location;
    if (location) {
      await saveUser(conversation, {
        city: null,
        lat: location.latitude,
        lng: location.longitude,
      });
      return;
    }
    const text = next.message?.text?.trim();
    if (text) {
      if (isSkipText(text, locale)) {
        await saveUser(conversation, { city: null, lat: null, lng: null });
        return;
      }
      if (isReservedInput(text)) {
        await next.reply(t(locale, "onboardingLocationBad"), {
          reply_markup: onboardingLocationKeyboard(locale),
        });
        continue;
      }
      await saveUser(conversation, { city: text, lat: null, lng: null });
      return;
    }
    await next.reply(t(locale, "onboardingLocationBad"), {
      reply_markup: onboardingLocationKeyboard(locale),
    });
  }
}

export async function askSnippetText(
  conversation: OnboardingConversation,
  ctx: Context,
  locale: Locale,
  cancelText?: string,
): Promise<{ content: string; language: string | null }> {
  const stop = cancelText ?? t(locale, "onboardingCancelled");
  const send = (target: Context) =>
    target.reply(t(locale, "onboardingSnippet"), { reply_markup: REMOVE_KEYBOARD });
  await send(ctx);
  for (;;) {
    const next = await waitUpdate(conversation, send, stop);
    if (next.message?.photo) {
      await next.reply(t(locale, "onboardingSnippetBad"), { reply_markup: REMOVE_KEYBOARD });
      continue;
    }
    const message = next.message;
    const text = message?.text;
    if (text !== undefined) {
      if (isReservedInput(text)) {
        await next.reply(t(locale, "onboardingSnippetBad"), { reply_markup: REMOVE_KEYBOARD });
        continue;
      }
      if (text.length >= 1 && text.length <= 1500) {
        const detected = detectSnippetLanguage(text, message?.entities);
        if (detected.content.length === 0) {
          await next.reply(t(locale, "onboardingSnippetBad"), { reply_markup: REMOVE_KEYBOARD });
          continue;
        }
        return detected;
      }
    }
    await next.reply(t(locale, "onboardingSnippetBad"), { reply_markup: REMOVE_KEYBOARD });
  }
}

export async function askSnippetLanguage(
  conversation: OnboardingConversation,
  ctx: Context,
  locale: Locale,
  cancelText?: string,
): Promise<string> {
  const stop = cancelText ?? t(locale, "onboardingCancelled");
  const send = (target: Context) =>
    target.reply(t(locale, "onboardingSnippetLang"), { reply_markup: snippetLangKeyboard() });
  await send(ctx);
  for (;;) {
    const next = await waitUpdate(conversation, send, stop);
    const data = next.callbackQuery?.data;
    if (data?.startsWith("ob:slang:")) {
      const language = data.slice("ob:slang:".length);
      if (isSnippetLanguage(language)) {
        await dropMarkup(next);
        return language;
      }
    }
    await next.reply(t(locale, "onboardingSnippetLangBad"), {
      reply_markup: snippetLangKeyboard(),
    });
  }
}

export async function saveSnippet(
  conversation: OnboardingConversation,
  content: string,
  language: string,
  position: number,
): Promise<void> {
  await conversation.external(async (outer) => {
    if (!outer.from) return;
    await insertSnippet(outer.db, {
      userId: outer.from.id,
      language,
      content,
      position,
    });
  });
}

async function askMoreSnippets(
  conversation: OnboardingConversation,
  ctx: Context,
  locale: Locale,
  startCount: number,
): Promise<void> {
  let count = startCount;
  while (count < 3) {
    const send = (target: Context) =>
      target.reply(t(locale, "onboardingSnippetMore"), {
        reply_markup: onboardingMoreKeyboard(locale),
      });
    await send(ctx);
    let add = false;
    for (;;) {
      const next = await waitUpdate(conversation, send, t(locale, "onboardingCancelled"));
      const data = next.callbackQuery?.data;
      if (data === "ob:snip:done") {
        await dropMarkup(next);
        return;
      }
      if (data === "ob:snip:more") {
        await dropMarkup(next);
        add = true;
        ctx = next;
        break;
      }
      const fromText = next.message?.text ? matchSnippetMoreButton(next.message.text, locale) : null;
      if (fromText === "done") return;
      if (fromText === "add") {
        add = true;
        ctx = next;
        break;
      }
      await next.reply(t(locale, "onboardingSnippetMore"), {
        reply_markup: onboardingMoreKeyboard(locale),
      });
    }
    if (!add) return;
    const { content, language: detected } = await askSnippetText(conversation, ctx, locale);
    const language = detected ?? (await askSnippetLanguage(conversation, ctx, locale));
    await saveSnippet(conversation, content, language, count);
    count += 1;
  }
}

async function askPreview(
  conversation: OnboardingConversation,
  ctx: Context,
  locale: Locale,
  user: UserRecord,
  snippets: SnippetRecord[],
): Promise<"ok" | "reset"> {
  const nowMs = await conversation.now();
  const card = renderOwnCard({
    name: user.name ?? "",
    birthYear: user.birthYear ?? 0,
    bio: user.bio,
    city: user.city,
    gender: user.gender,
    locale,
    snippets,
    nowMs,
    includeAllSnippets: true,
    header: t(locale, "ownCardFrame"),
    footer: t(locale, "onboardingPreview"),
  });
  const send = async (target: Context) => {
    await target.reply(card, {
      parse_mode: "HTML",
      reply_markup: onboardingPreviewKeyboard(locale),
    });
  };
  await send(ctx);
  for (;;) {
    const next = await waitUpdate(conversation, send, t(locale, "onboardingCancelled"));
    const data = next.callbackQuery?.data;
    if (data === "ob:preview:ok" || data === "ob:preview:reset") {
      await dropMarkup(next);
      return data.endsWith("ok") ? "ok" : "reset";
    }
    const fromText = next.message?.text ? matchPreviewButton(next.message.text, locale) : null;
    if (fromText) return fromText;
    await next.reply(t(locale, "onboardingPreviewBad"), {
      reply_markup: onboardingPreviewKeyboard(locale),
    });
  }
}

export async function onboarding(conversation: OnboardingConversation, ctx: Context) {
  await conversation.external(async (outer) => {
    if (!outer.from) return;
    await insertEventOnce(outer.db, outer.from.id, "onboarding_start");
  });

  for (;;) {
    let user = await loadUser(conversation);
    if (!user) {
      await ctx.reply(t("en", "onboardingMissingUser"));
      return;
    }
    let locale = localeOf(user);
    let step = normalizeStep(user.state);

    if (step === "onboarding:lang") {
      locale = await askLanguage(conversation, ctx, locale);
      await setStep(conversation, "onboarding:name");
      step = "onboarding:name";
      user = (await loadUser(conversation)) ?? user;
    }

    if (step === "onboarding:name") {
      if (!user.name) await askName(conversation, ctx, locale);
      await setStep(conversation, "onboarding:year");
      step = "onboarding:year";
      user = (await loadUser(conversation)) ?? user;
    }

    if (step === "onboarding:year") {
      if (user.birthYear == null) await askYear(conversation, ctx, locale);
      await setStep(conversation, "onboarding:gender");
      step = "onboarding:gender";
      user = (await loadUser(conversation)) ?? user;
    }

    if (step === "onboarding:gender") {
      if (user.gender == null) await askGender(conversation, ctx, locale);
      await setStep(conversation, "onboarding:bio");
      step = "onboarding:bio";
      user = (await loadUser(conversation)) ?? user;
    }

    if (step === "onboarding:bio") {
      await askBio(conversation, ctx, locale);
      await setStep(conversation, "onboarding:location");
      step = "onboarding:location";
      user = (await loadUser(conversation)) ?? user;
    }

    if (step === "onboarding:location") {
      await askLocation(conversation, ctx, locale);
      await setStep(conversation, "onboarding:snippets");
      step = "onboarding:snippets";
      user = (await loadUser(conversation)) ?? user;
    }

    if (step === "onboarding:snippets") {
      let snippets = await loadSnippets(conversation);
      if (snippets.length === 0) {
        const { content, language: detected } = await askSnippetText(conversation, ctx, locale);
        const language = detected ?? (await askSnippetLanguage(conversation, ctx, locale));
        await saveSnippet(conversation, content, language, 0);
        snippets = await loadSnippets(conversation);
      }
      if (snippets.length < 3) {
        await askMoreSnippets(conversation, ctx, locale, snippets.length);
      }
      await setStep(conversation, "onboarding:preview");
      step = "onboarding:preview";
    }

    user = (await loadUser(conversation)) ?? user;
    const snippets = await loadSnippets(conversation);
    const decision = await askPreview(conversation, ctx, locale, user, snippets);
    if (decision === "reset") {
      await conversation.external(async (outer) => {
        if (!outer.from) return;
        await clearOnboardingFields(outer.db, outer.from.id);
      });
      continue;
    }

    await conversation.external(async (outer) => {
      if (!outer.from) return;
      await completeProfile(outer.db, outer.from.id);
    });

    const username = await conversation.external((outer) => outer.from?.username ?? null);
    if (!username) {
      await ctx.reply(t(locale, "onboardingUsernameWarn"));
    }

    await conversation.external(async (outer) => {
      await replyNextFeedCard(outer);
    });
    return;
  }
}
