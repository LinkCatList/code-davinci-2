import { conversations, createConversation } from "@grammyjs/conversations";
import { Bot, type Context } from "grammy";
import type { UserFromGetMe } from "grammy/types";
import { drizzle } from "drizzle-orm/d1";
import {
  getUser,
  isOnboarding,
  isProfileComplete,
  listSnippets,
  upsertUser,
} from "./db/queries";
import * as schema from "./db/schema";
import { d1SessionStorage } from "./db/session-storage";
import type { Env } from "./env";
import { renderOwnCard } from "./flows/card";
import { onboarding, type OutsideContext } from "./flows/onboarding";
import { t } from "./t";

export type BotContext = OutsideContext;

const STUB_COMMANDS = ["feed", "profile", "matches", "filters", "language", "delete"] as const;

async function showOwnCard(ctx: BotContext): Promise<void> {
  if (!ctx.from) return;
  const user = await getUser(ctx.db, ctx.from.id);
  if (!user || user.name === null || user.birthYear === null) return;
  const snippets = await listSnippets(ctx.db, user.id);
  await ctx.reply(
    renderOwnCard({
      name: user.name,
      birthYear: user.birthYear,
      bio: user.bio,
      city: user.city,
      snippets,
      nowMs: Date.now(),
      includeAllSnippets: true,
      footer: t(ctx.locale, "profileReady"),
    }),
    { parse_mode: "HTML" },
  );
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

  bot.use(
    conversations<BotContext, Context>({
      storage: {
        type: "key",
        version: 3,
        getStorageKey: (ctx) => (ctx.from ? String(ctx.from.id) : undefined),
        adapter: d1SessionStorage(env.DB),
      },
    }),
  );
  bot.use(createConversation(onboarding));

  bot.command("start", async (ctx) => {
    if (!ctx.from) return;
    const user = await getUser(ctx.db, ctx.from.id);
    if (!user) return;
    const snippets = await listSnippets(ctx.db, user.id);
    if (isProfileComplete(user, snippets.length)) {
      await showOwnCard(ctx);
      return;
    }
    if (ctx.conversation.active("onboarding") > 0) return;
    await ctx.conversation.enter("onboarding");
  });

  bot.command("cancel", async (ctx) => {
    if (ctx.conversation.active("onboarding") > 0) {
      await ctx.conversation.exit("onboarding");
    }
    if (!ctx.from) return;
    const user = await getUser(ctx.db, ctx.from.id);
    if (user && isOnboarding(user)) {
      await ctx.reply(t(ctx.locale, "onboardingCancelled"));
      return;
    }
    await ctx.reply(t(ctx.locale, "nothingToCancel"));
  });

  for (const command of STUB_COMMANDS) {
    bot.command(command, async (ctx) => {
      if (!ctx.from) return;
      const user = await getUser(ctx.db, ctx.from.id);
      if (user && isOnboarding(user)) {
        await ctx.reply(t(ctx.locale, "finishOnboardingFirst"));
        return;
      }
      await ctx.reply(t(ctx.locale, "comingSoon"));
    });
  }

  return bot;
}
