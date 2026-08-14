import { existsSync, readFileSync } from "node:fs";
import { en } from "../src/i18n/en";
import { ru } from "../src/i18n/ru";

if (existsSync(".dev.vars")) {
  for (const line of readFileSync(".dev.vars", "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq);
    const value = trimmed.slice(eq + 1);
    if (value && !process.env[key]) process.env[key] = value;
  }
}

const token = process.env.BOT_TOKEN;
const secret = process.env.WEBHOOK_SECRET;
const workerUrl = process.env.WORKER_URL;

if (!token || !secret || !workerUrl) {
  console.error("Need BOT_TOKEN, WEBHOOK_SECRET, WORKER_URL");
  process.exit(1);
}

const webhookUrl = `${workerUrl.replace(/\/$/, "")}/webhook/${secret}`;

const commands = (d: typeof ru) => [
  { command: "start", description: d.cmdStart },
  { command: "feed", description: d.cmdFeed },
  { command: "profile", description: d.cmdProfile },
  { command: "filters", description: d.cmdFilters },
  { command: "language", description: d.cmdLanguage },
  { command: "delete", description: d.cmdDelete },
  { command: "cancel", description: d.cmdCancel },
];

async function telegram(method: string, body: unknown) {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as { ok: boolean; description?: string };
  if (!json.ok) {
    throw new Error(`${method} failed: ${json.description ?? res.status}`);
  }
}

await telegram("setWebhook", {
  url: webhookUrl,
  secret_token: secret,
  allowed_updates: ["message", "callback_query"],
  drop_pending_updates: true,
});

await telegram("setMyCommands", { commands: commands(en) });
await telegram("setMyCommands", { commands: commands(ru), language_code: "ru" });
await telegram("setMyCommands", { commands: commands(en), language_code: "en" });

console.log(`webhook set: ${webhookUrl}`);
