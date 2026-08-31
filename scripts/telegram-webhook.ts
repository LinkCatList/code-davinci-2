import { existsSync, readFileSync } from "node:fs";
import { en } from "../src/i18n/en";
import { ru } from "../src/i18n/ru";

type TelegramResponse<T> = {
  ok: boolean;
  result?: T;
  description?: string;
};

export type TelegramConfig = {
  token: string;
  secret: string;
  workerUrl?: string;
};

export type WebhookInfo = {
  url: string;
};

export function loadDevVars(path = ".dev.vars"): void {
  if (!existsSync(path)) return;

  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separator = trimmed.indexOf("=");
    if (separator === -1) continue;

    const key = trimmed.slice(0, separator);
    const value = trimmed.slice(separator + 1);
    if (value && !process.env[key]) process.env[key] = value;
  }
}

export function loadTelegramConfig({ requireWorkerUrl = false } = {}): TelegramConfig {
  loadDevVars();

  const token = process.env.BOT_TOKEN;
  const secret = process.env.WEBHOOK_SECRET;
  const workerUrl = process.env.WORKER_URL;
  const missing = [
    !token && "BOT_TOKEN",
    !secret && "WEBHOOK_SECRET",
    requireWorkerUrl && !workerUrl && "WORKER_URL",
  ].filter(Boolean);

  if (missing.length > 0) {
    throw new Error(`Missing required environment variable(s): ${missing.join(", ")}`);
  }

  return { token: token!, secret: secret!, workerUrl };
}

export function buildWebhookUrl(workerUrl: string, secret: string): string {
  const url = new URL(workerUrl);
  url.search = "";
  url.hash = "";
  return `${url.toString().replace(/\/$/, "")}/webhook/${secret}`;
}

export function redactSecret(value: string, secret: string): string {
  if (!secret) return value;
  return value.replaceAll(`/webhook/${secret}`, "/webhook/[redacted]").replaceAll(secret, "[redacted]");
}

export function redactWebhookUrl(webhookUrl: string, secret: string): string {
  return redactSecret(webhookUrl, secret);
}

function commands(dictionary: typeof ru) {
  return [
    { command: "start", description: dictionary.cmdStart },
    { command: "feed", description: dictionary.cmdFeed },
    { command: "profile", description: dictionary.cmdProfile },
    { command: "likes", description: dictionary.cmdLikes },
    { command: "matches", description: dictionary.cmdMatches },
    { command: "filters", description: dictionary.cmdFilters },
    { command: "language", description: dictionary.cmdLanguage },
    { command: "delete", description: dictionary.cmdDelete },
    { command: "cancel", description: dictionary.cmdCancel },
  ];
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function telegram<T>(config: TelegramConfig, method: string, body: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`https://api.telegram.org/bot${config.token}/${method}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });
  } catch (error) {
    throw new Error(`${method} failed: ${redactSecret(errorMessage(error), config.secret)}`);
  }

  let json: TelegramResponse<T>;
  try {
    json = (await response.json()) as TelegramResponse<T>;
  } catch (error) {
    throw new Error(`${method} failed: invalid Telegram response (${errorMessage(error)})`);
  }

  if (!response.ok || !json.ok) {
    throw new Error(`${method} failed: ${redactSecret(json.description ?? `HTTP ${response.status}`, config.secret)}`);
  }

  return json.result as T;
}

export async function registerWebhook(config: TelegramConfig, workerUrl: string): Promise<string> {
  const webhookUrl = buildWebhookUrl(workerUrl, config.secret);

  await telegram<true>(config, "setWebhook", {
    url: webhookUrl,
    secret_token: config.secret,
    allowed_updates: ["message", "callback_query"],
    drop_pending_updates: true,
  });

  await telegram<true>(config, "setMyCommands", { commands: commands(en) });
  await telegram<true>(config, "setMyCommands", {
    commands: commands(ru),
    language_code: "ru",
  });
  await telegram<true>(config, "setMyCommands", {
    commands: commands(en),
    language_code: "en",
  });

  const info = await telegram<WebhookInfo>(config, "getWebhookInfo", {});
  if (info.url !== webhookUrl) {
    throw new Error(
      `Telegram webhook verification failed: expected ${redactWebhookUrl(webhookUrl, config.secret)}, got ${redactSecret(info.url, config.secret)}`,
    );
  }

  return webhookUrl;
}

export async function deleteWebhookIfCurrent(config: TelegramConfig, webhookUrl: string): Promise<boolean> {
  const info = await telegram<WebhookInfo>(config, "getWebhookInfo", {});
  if (info.url !== webhookUrl) return false;

  await telegram<true>(config, "deleteWebhook", { drop_pending_updates: false });
  return true;
}

