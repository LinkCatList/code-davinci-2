import { webhookCallback } from "grammy";
import type { UserFromGetMe } from "grammy/types";
import { createBot } from "./bot";
import type { Env } from "./env";

let cachedBotInfo: UserFromGetMe | undefined;

export default {
  async fetch(request: Request, env: Env, executionCtx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname !== `/webhook/${env.WEBHOOK_SECRET}`) {
      return new Response("Not found", { status: 404 });
    }

    const botInfo = env.BOT_INFO
      ? (JSON.parse(env.BOT_INFO) as UserFromGetMe)
      : cachedBotInfo;
    const bot = createBot(env, executionCtx, botInfo);
    if (!botInfo) {
      await bot.init();
      cachedBotInfo = bot.botInfo;
    }

    return webhookCallback(bot, "cloudflare-mod", {
      secretToken: env.WEBHOOK_SECRET,
    })(request);
  },
};
