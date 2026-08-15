import { conversations, createConversation } from "@grammyjs/conversations";
import { Bot, type Context } from "grammy";
import type { UserFromGetMe } from "grammy/types";
import { drizzle } from "drizzle-orm/d1";
import {
  clearOnboardingFields,
  getUser,
  isOnboarding,
  isProfileComplete,
  listSnippets,
  setBrowseState,
  setUserPaused,
  upsertUser,
} from "./db/queries";
import * as schema from "./db/schema";
import { d1SessionStorage } from "./db/session-storage";
import type { Env } from "./env";
import {
  handleFeedCallback,
  handleFeedCommand,
  handleLikesAction,
  handleLikesOpen,
  handleBrowseAction,
  replyNextIncomingLike,
} from "./flows/feed";
import { flushPendingReveals, handleMatchesCommand } from "./flows/match";
import { onboarding, type OutsideContext } from "./flows/onboarding";
import { editProfile, handleProfileCallback, handleProfileCommand, startProfileEdit } from "./flows/profile";
import { isPausedUser, parseBrowseMode, replyHome, replyPaused } from "./flows/screens";
import {
  homeKeyboard,
  keyboardFor,
  looksLikeOtherLocaleMenu,
  matchMenuAction,
  type MenuAction,
  withMenuLegend,
} from "./keyboards";
import { t } from "./t";

export type BotContext = OutsideContext;

const STUB_COMMANDS = ["filters", "language", "delete"] as const;

async function replyStub(ctx: BotContext): Promise<void> {
  if (!ctx.from) return;
  const user = await getUser(ctx.db, ctx.from.id);
  if (user && isOnboarding(user)) {
    await ctx.reply(t(ctx.locale, "finishOnboardingFirst"));
    return;
  }
  if (user && isPausedUser(user)) {
    await replyPaused(ctx);
    return;
  }
  await setBrowseState(ctx.db, ctx.from.id, "home", null);
  await ctx.reply(withMenuLegend(t(ctx.locale, "comingSoon"), "home", ctx.locale), {
    reply_markup: homeKeyboard(ctx.locale),
  });
}

async function restartProfile(ctx: BotContext): Promise<void> {
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
  if (ctx.conversation.active("editProfile") > 0) {
    await ctx.conversation.exit("editProfile");
  }
  if (ctx.conversation.active("onboarding") > 0) return;
  await clearOnboardingFields(ctx.db, ctx.from.id);
  await ctx.conversation.enter("onboarding");
}

async function pauseProfile(ctx: BotContext): Promise<void> {
  if (!ctx.from) return;
  const user = await getUser(ctx.db, ctx.from.id);
  if (!user || isOnboarding(user)) {
    await ctx.reply(t(ctx.locale, "finishOnboardingFirst"));
    return;
  }
  await setUserPaused(ctx.db, ctx.from.id);
  await replyPaused(ctx);
}

async function dispatchMenu(ctx: BotContext, action: MenuAction): Promise<void> {
  switch (action) {
    case "browse":
      await handleFeedCommand(ctx);
      return;
    case "profile":
      await handleProfileCommand(ctx);
      return;
    case "likes":
      await replyNextIncomingLike(ctx);
      return;
    case "matches":
      await handleMatchesCommand(ctx);
      return;
    case "like":
      await handleBrowseAction(ctx, "like");
      return;
    case "skip":
      await handleBrowseAction(ctx, "skip");
      return;
    case "sleep":
      await handleBrowseAction(ctx, "sleep");
      return;
    case "restart":
      await restartProfile(ctx);
      return;
    case "snippets":
      await startProfileEdit(ctx, "snippets");
      return;
    case "bio":
      await startProfileEdit(ctx, "bio");
      return;
    case "pause":
      await pauseProfile(ctx);
  }
}

async function handleMenuText(ctx: BotContext): Promise<void> {
  const text = ctx.message?.text;
  if (!text || !ctx.from) return;
  if (text.startsWith("/")) return;
  const user = await getUser(ctx.db, ctx.from.id);
  if (!user || isOnboarding(user)) return;

  if (isPausedUser(user)) {
    const action = matchMenuAction(text, ctx.locale, "paused");
    if (action === "browse") {
      await handleFeedCommand(ctx);
      return;
    }
    await replyPaused(ctx);
    return;
  }

  const screen = parseBrowseMode(user.browseMode);
  const action = matchMenuAction(text, ctx.locale, screen);
  if (!action) {
    if (looksLikeOtherLocaleMenu(text, ctx.locale)) {
      const hint =
        screen === "feed" || screen === "inbox"
          ? t(ctx.locale, "useMenu")
          : withMenuLegend(t(ctx.locale, "useMenu"), screen, ctx.locale);
      await ctx.reply(hint, { reply_markup: keyboardFor(screen, ctx.locale) });
    }
    return;
  }
  await dispatchMenu(ctx, action);
}

export function createBot(
  env: Env,
  executionCtx: ExecutionContext,
  botInfo?: UserFromGetMe,
): Bot<BotContext> {
  const db = drizzle(env.DB, { schema });
  const bot = new Bot<BotContext>(env.BOT_TOKEN, botInfo ? { botInfo } : {});

  bot.use(async (ctx, next) => {
    ctx.db = db;
    ctx.executionCtx = executionCtx;
    await next();
  });

  bot.use(async (ctx, next) => {
    if (ctx.chat && ctx.chat.type !== "private") return;
    await next();
  });

  bot.use(async (ctx, next) => {
    if (!ctx.from) return;
    const { locale } = await upsertUser(ctx.db, ctx.from);
    ctx.locale = locale;
    await next();
  });

  bot.use(async (ctx, next) => {
    await flushPendingReveals(ctx);
    await next();
  });

  bot.use(
    conversations<BotContext, Context>({
      storage: {
        type: "key",
        version: 4,
        getStorageKey: (ctx) => (ctx.from ? String(ctx.from.id) : undefined),
        adapter: d1SessionStorage(env.DB),
      },
    }),
  );
  bot.use(createConversation(onboarding));
  bot.use(createConversation(editProfile, "editProfile"));

  bot.command("start", async (ctx) => {
    if (!ctx.from) return;
    const user = await getUser(ctx.db, ctx.from.id);
    if (!user) return;
    const snippets = await listSnippets(ctx.db, user.id);
    if (isProfileComplete(user, snippets.length)) {
      if (isPausedUser(user)) {
        await replyPaused(ctx);
        return;
      }
      await replyHome(ctx);
      return;
    }
    if (ctx.conversation.active("onboarding") > 0) return;
    await ctx.conversation.enter("onboarding");
  });

  bot.command("profile", handleProfileCommand);
  bot.callbackQuery(/^pf:(name|year|gender|bio|loc|snippets)$/, handleProfileCallback);
  bot.command("feed", handleFeedCommand);
  bot.command("matches", handleMatchesCommand);
  bot.callbackQuery(/^fd:(like|skip):\d+$/, handleFeedCallback);
  bot.callbackQuery(/^lk:open$/, handleLikesOpen);
  bot.callbackQuery(/^lk:(like|skip):\d+$/, handleLikesAction);

  bot.command("cancel", async (ctx) => {
    if (ctx.conversation.active("onboarding") > 0) {
      await ctx.conversation.exit("onboarding");
    }
    if (ctx.conversation.active("editProfile") > 0) {
      await ctx.conversation.exit("editProfile");
    }
    if (!ctx.from) return;
    const user = await getUser(ctx.db, ctx.from.id);
    if (user && isOnboarding(user)) {
      await ctx.reply(t(ctx.locale, "onboardingCancelled"));
      return;
    }
    if (user && isPausedUser(user)) {
      await replyPaused(ctx);
      return;
    }
    if (user) {
      await replyHome(ctx);
      return;
    }
    await ctx.reply(t(ctx.locale, "nothingToCancel"));
  });

  for (const command of STUB_COMMANDS) {
    bot.command(command, replyStub);
  }

  bot.on("message:text", handleMenuText);

  return bot;
}
