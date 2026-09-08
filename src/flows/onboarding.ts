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
  isOnboarding,
  listSnippets,
  patchUser,
  setBrowseState,
  upsertSnippet,
  type SnippetRecord,
  type UserRecord,
} from "../db/queries";
import {
  isReservedInput,
  isSkipText,
  matchGenderButton,
  matchLangButton,
  matchPreviewButton,
  onboardingBioKeyboard,
  onboardingGenderKeyboard,
  onboardingLangKeyboard,
  onboardingPreviousKeyboard,
  onboardingPreviewKeyboard,
  onboardingSnippetKeyboard,
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
type OnboardingMode = "initial" | "refill";

const STEPS = [
  "onboarding:lang",
  "onboarding:name",
  "onboarding:year",
  "onboarding:gender",
  "onboarding:bio",
  "onboarding:snippets",
  "onboarding:preview",
] as const;

type OnboardingStep = (typeof STEPS)[number];
const REFILL_STATE_PREFIX = "onboarding:refill:";

function isRefillState(state: string | null | undefined): boolean {
  return state?.startsWith(REFILL_STATE_PREFIX) ?? false;
}

function normalizeStep(state: string | null): OnboardingStep {
  if (state?.startsWith(REFILL_STATE_PREFIX)) {
    state = `onboarding:${state.slice(REFILL_STATE_PREFIX.length)}`;
  }
  if (state === "onboarding" || state === null) return "onboarding:lang";
  if (state === "onboarding:photo") return "onboarding:snippets";
  if (state === "onboarding:location") return "onboarding:lang";
  if ((STEPS as readonly string[]).includes(state)) return state as OnboardingStep;
  return "onboarding:lang";
}

function commandName(ctx: Context): string | undefined {
  const raw = ctx.message?.text;
  if (!raw) return undefined;
  const match = /^\/([a-z0-9_]+)(?:@[a-z0-9_]+)?(?:\s|$)/i.exec(raw);
  return match?.[1]?.toLowerCase();
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

async function setStep(
  conversation: OnboardingConversation,
  state: OnboardingStep,
  isRefill = false,
): Promise<void> {
  const storedState = isRefill
    ? `${REFILL_STATE_PREFIX}${state.slice("onboarding:".length)}`
    : state;
  await saveUser(conversation, { state: storedState });
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
  previousName?: string | null,
): Promise<void> {
  const stop = cancelText ?? t(locale, "onboardingCancelled");
  const send = (target: Context) =>
    target.reply(t(locale, "onboardingName"), {
      reply_markup: onboardingPreviousKeyboard(previousName),
    });
  await send(ctx);
  for (;;) {
    const next = await waitUpdate(conversation, send, stop);
    const text = next.message?.text?.trim();
    if (text && isReservedInput(text) && text !== previousName) {
      await next.reply(t(locale, "onboardingNameBad"), {
        reply_markup: onboardingPreviousKeyboard(previousName),
      });
      continue;
    }
    if (text && text.length >= 1 && text.length <= 50) {
      await saveUser(conversation, { name: text });
      return;
    }
    await next.reply(t(locale, "onboardingNameBad"), {
      reply_markup: onboardingPreviousKeyboard(previousName),
    });
  }
}

export async function askYear(
  conversation: OnboardingConversation,
  ctx: Context,
  locale: Locale,
  cancelText?: string,
  previousYear?: number | null,
): Promise<void> {
  const stop = cancelText ?? t(locale, "onboardingCancelled");
  const send = (target: Context) =>
    target.reply(t(locale, "onboardingYear"), {
      reply_markup: onboardingPreviousKeyboard(previousYear),
    });
  await send(ctx);
  for (;;) {
    const next = await waitUpdate(conversation, send, stop);
    const text = next.message?.text?.trim();
    if (!text || !/^\d{4}$/.test(text)) {
      await next.reply(t(locale, "onboardingYearBad"), {
        reply_markup: onboardingPreviousKeyboard(previousYear),
      });
      continue;
    }
    const year = Number(text);
    const nowMs = await conversation.now();
    const currentYear = new Date(nowMs).getUTCFullYear();
    if (year < currentYear - 120 || year > currentYear) {
      await next.reply(t(locale, "onboardingYearBad"), {
        reply_markup: onboardingPreviousKeyboard(previousYear),
      });
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
  previousBio?: string | null,
): Promise<void> {
  const stop = cancelText ?? t(locale, "onboardingCancelled");
  const send = (target: Context) =>
    target.reply(t(locale, "onboardingBio"), {
      reply_markup: onboardingBioKeyboard(locale, previousBio ?? null),
    });
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
      if (
        previousBio !== null &&
        previousBio !== undefined &&
        text.trim() === t(locale, "onboardingKeepPrevious")
      ) {
        await saveUser(conversation, { bio: previousBio });
        return;
      }
      if (isSkipText(text, locale)) {
        await saveUser(conversation, { bio: null });
        return;
      }
      if (isReservedInput(text)) {
        await next.reply(t(locale, "onboardingBioBad"), {
          reply_markup: onboardingBioKeyboard(locale, previousBio ?? null),
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
          reply_markup: onboardingBioKeyboard(locale, previousBio ?? null),
        });
        continue;
      }
      await saveUser(conversation, { bio: trimmed });
      return;
    }
    await next.reply(t(locale, "onboardingBioBad"), {
      reply_markup: onboardingBioKeyboard(locale, previousBio ?? null),
    });
  }
}

export async function askSnippetText(
  conversation: OnboardingConversation,
  ctx: Context,
  locale: Locale,
  cancelText?: string,
  previousSnippet?: Pick<SnippetRecord, "content" | "language"> | null,
): Promise<{ content: string; language: string | null }> {
  const stop = cancelText ?? t(locale, "onboardingCancelled");
  const replyMarkup = () =>
    onboardingSnippetKeyboard(
      locale,
      previousSnippet !== null && previousSnippet !== undefined,
    );
  const send = (target: Context) =>
    target.reply(t(locale, "onboardingSnippet"), {
      reply_markup: replyMarkup(),
    });
  await send(ctx);
  for (;;) {
    const next = await waitUpdate(conversation, send, stop);
    if (next.message?.photo) {
      await next.reply(t(locale, "onboardingSnippetBad"), { reply_markup: replyMarkup() });
      continue;
    }
    const message = next.message;
    const text = message?.text;
    if (text !== undefined) {
      if (
        previousSnippet &&
        text.trim() === t(locale, "onboardingKeepPrevious")
      ) {
        return previousSnippet;
      }
      if (isReservedInput(text)) {
        await next.reply(t(locale, "onboardingSnippetBad"), {
          reply_markup: replyMarkup(),
        });
        continue;
      }
      if (text.length >= 1 && text.length <= 1500) {
        const detected = detectSnippetLanguage(text, message?.entities);
        if (detected.content.length === 0) {
          await next.reply(t(locale, "onboardingSnippetBad"), { reply_markup: replyMarkup() });
          continue;
        }
        return detected;
      }
    }
    await next.reply(t(locale, "onboardingSnippetBad"), {
      reply_markup: replyMarkup(),
    });
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
): Promise<void> {
  await conversation.external(async (outer) => {
    if (!outer.from) return;
    await upsertSnippet(outer.db, {
      userId: outer.from.id,
      language,
      content,
    });
  });
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

export async function onboarding(
  conversation: OnboardingConversation,
  ctx: Context,
  mode: OnboardingMode = "initial",
) {
  await conversation.external(async (outer) => {
    if (!outer.from) return;
    await insertEventOnce(outer.db, outer.from.id, "onboarding_start");
  });

  const entryUser = await loadUser(conversation);
  const isRefill = mode === "refill" || isRefillState(entryUser?.state);
  const previousUser = isRefill ? entryUser : null;
  const previousSnippets = isRefill ? await loadSnippets(conversation) : [];
  const previousSnippet = previousSnippets[0] ?? null;

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
      await setStep(conversation, "onboarding:name", isRefill);
      step = "onboarding:name";
      user = (await loadUser(conversation)) ?? user;
    }

    if (step === "onboarding:name") {
      if (isRefill || !user.name) {
        await askName(conversation, ctx, locale, undefined, previousUser?.name);
      }
      await setStep(conversation, "onboarding:year", isRefill);
      step = "onboarding:year";
      user = (await loadUser(conversation)) ?? user;
    }

    if (step === "onboarding:year") {
      if (isRefill || user.birthYear == null) {
        await askYear(conversation, ctx, locale, undefined, previousUser?.birthYear);
      }
      await setStep(conversation, "onboarding:gender", isRefill);
      step = "onboarding:gender";
      user = (await loadUser(conversation)) ?? user;
    }

    if (step === "onboarding:gender") {
      if (isRefill || user.gender == null) await askGender(conversation, ctx, locale);
      await setStep(conversation, "onboarding:bio", isRefill);
      step = "onboarding:bio";
      user = (await loadUser(conversation)) ?? user;
    }

    if (step === "onboarding:bio") {
      await askBio(conversation, ctx, locale, undefined, previousUser?.bio);
      await setStep(conversation, "onboarding:snippets", isRefill);
      step = "onboarding:snippets";
      user = (await loadUser(conversation)) ?? user;
    }

    if (step === "onboarding:snippets") {
      const snippets = await loadSnippets(conversation);
      if (isRefill || snippets.length === 0) {
        const { content, language: detected } = await askSnippetText(
          conversation,
          ctx,
          locale,
          undefined,
          previousSnippet,
        );
        const language = detected ?? (await askSnippetLanguage(conversation, ctx, locale));
        await saveSnippet(conversation, content, language);
      }
      await setStep(conversation, "onboarding:preview", isRefill);
      step = "onboarding:preview";
    }

    user = (await loadUser(conversation)) ?? user;
    const snippets = await loadSnippets(conversation);
    const decision = await askPreview(conversation, ctx, locale, user, snippets);
    if (decision === "reset") {
      if (isRefill) {
        await setStep(conversation, "onboarding:name", true);
      } else {
        await conversation.external(async (outer) => {
          if (!outer.from) return;
          await clearOnboardingFields(outer.db, outer.from.id);
        });
      }
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
