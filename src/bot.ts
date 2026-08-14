import { Bot, type Context } from "grammy";
import { drizzle } from "drizzle-orm/d1";
import type { UserFromGetMe } from "grammy/types";
import { type Db, upsertUser } from "./db/queries";
import * as schema from "./db/schema";
import type { Env } from "./env";
import { t, type Locale } from "./t";

export type BotContext = Context & {
  db: Db;
  executionCtx: ExecutionContext;
  locale: Locale;
};

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

  bot.command("start", async (ctx) => {
    await ctx.reply(t(ctx.locale, "startWelcome"));
  });

  return bot;
}
