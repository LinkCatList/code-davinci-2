# Local development

The production workflow uses Node.js 24 and pnpm 11.15.1. Install dependencies with `pnpm install --frozen-lockfile`.

## Run the bot locally

1. If `.dev.vars` does not exist, copy `.dev.vars.example` to `.dev.vars` and set `BOT_TOKEN` and `WEBHOOK_SECRET`.
2. Make sure SSH can use the key that receives `https://24c0bf3675b238.lhr.life` from localhost.run.
3. Run `pnpm dev`. In another terminal, run `pnpm dev:tunnel` while the first command waits for the tunnel.

`pnpm dev` applies local D1 migrations, starts the Worker on port 8787, waits for the public health check, and registers the Telegram webhook and bot commands. On shutdown, it removes the webhook if it still points to this local run. The tunnel runs separately and must be stopped separately.

Use a separate test bot: registering a webhook replaces that bot's current webhook and drops pending updates. The configured localhost.run URL is fixed in `scripts/dev.ts`; if the assigned URL changes, update that constant and the example `WORKER_URL` in `.dev.vars.example`.

For Worker-only debugging, use `pnpm dev:worker`. To register a webhook manually, set `WORKER_URL` in `.dev.vars` and run `pnpm webhook`.

## Optional seed data

Generate fake profiles and load them into local D1:

```sh
pnpm db:seed
pnpm exec wrangler d1 execute DB --local --file=.temp/seed.sql
```

The generated SQL is local output. Fake profiles are excluded from the feed, incoming likes, and matches.

Run `pnpm typecheck` to check types. `pnpm db:migrate:remote` and `pnpm deploy` operate on production resources.
