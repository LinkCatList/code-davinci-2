# Local development

`pnpm dev` runs the Worker and D1 locally. It does not deploy the Worker or use the remote D1 database.

For Telegram, start a localhost.run SSH tunnel yourself at the fixed URL `https://64ce59a9c5d14b.lhr.life`. Then `pnpm dev` waits for `/health` through that tunnel and registers the webhook automatically. The URL is not a localhost.run custom domain.

## First setup

1. Copy `.dev.vars.example` to `.dev.vars` and fill in `BOT_TOKEN` and `WEBHOOK_SECRET`.
2. Ensure the SSH key that receives `64ce59a9c5d14b.lhr.life` is available to `ssh`.
3. Start local development:

   ```bash
   pnpm dev
   ```

4. While `pnpm dev` is waiting for public health, start the SSH tunnel in a second terminal:

   ```bash
   pnpm dev:tunnel
   ```

`pnpm dev` applies pending local D1 migrations, starts Wrangler on `http://127.0.0.1:8787`, verifies public health through your tunnel, and registers Telegram. On graceful shutdown, it removes only the webhook registered by that local run; it does not stop your tunnel.

## Running pieces separately

For raw Worker debugging without automatic webhook registration:

```bash
pnpm dev:worker
```

In a second terminal:

```bash
pnpm dev:tunnel
```

Then register the fixed public URL manually:

```bash
WORKER_URL=https://64ce59a9c5d14b.lhr.life pnpm webhook
```

Changes are picked up by Wrangler without a deploy.

## Optional local seed data

To generate fake profile fixtures and load them into local D1:

```bash
pnpm db:seed
pnpm exec wrangler d1 execute DB --local --file=.temp/seed.sql
```

The application excludes these fixtures from the feed, incoming likes, and matches.

Use `pnpm db:migrate:remote` and `pnpm deploy` only for deliberate production changes.
