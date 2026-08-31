# Plan: One-command Telegram local development

## Problem statement

Local development is currently split across several manual steps: the Worker is started separately, a Quick Tunnel is started separately, `WORKER_URL` is supplied manually, and the Telegram webhook is registered from another command. The tunnel URL can appear before the public proxy is actually forwarding requests to the Worker, so registering the webhook too early can point Telegram at a `530` state.

The goal is to make `pnpm dev` the only command needed for normal Telegram bot development. It must use only the local Worker and local D1, wait until the Worker is genuinely reachable through the public tunnel, configure Telegram, and then remain as a foreground process with live logs.

## Current behavior

- `pnpm dev` runs only `wrangler dev --local`.
- `pnpm dev:tunnel` runs `wrangler dev --local --tunnel`, but does not run migrations or configure Telegram.
- `scripts/set-webhook.ts` independently loads `.dev.vars`, builds the secret URL, calls `setWebhook`, and calls `setMyCommands` three times; it currently prints a URL containing the secret.
- The Worker accepts only `/webhook/${WEBHOOK_SECRET}`; there is no separate safe health route.
- Local D1 migrations are available through `wrangler d1 migrations apply DB --local`; the dev flow has no automatic seed/reset behavior.
- Wrangler 4.122 prints a Quick Tunnel as `https://<id>.trycloudflare.com`, but the presence of that line alone does not prove that public requests are already reaching the Worker.

## Target behavior

After filling only `BOT_TOKEN` and `WEBHOOK_SECRET` in `.dev.vars`:

1. `pnpm dev` validates both values.
2. It applies only pending local D1 migrations, without seeding or resetting.
3. It starts `wrangler dev --local --tunnel` and forwards its stdout/stderr to the terminal.
4. It extracts the temporary HTTPS Quick Tunnel URL from Wrangler output.
5. It polls `GET <tunnel>/health` until the Worker gives a real response. Until a successful HTTP 2xx response, including an intermediate `530`, the webhook is not registered.
6. It registers the webhook with `drop_pending_updates: true`, sets the bot commands, and verifies with `getWebhookInfo` that Telegram points exactly to this runner's URL.
7. It prints the ready state only after all checks succeed.
8. On `Ctrl-C`, `SIGINT`, or `SIGTERM`, it stops the Worker and deletes the webhook only if Telegram still points to this run's URL. Deletion uses `drop_pending_updates: false`, so newly queued messages are preserved.
9. If another process changes the webhook, this runner does not delete the other URL.

The explicit `pnpm webhook` manual override continues to require `WORKER_URL`; it is not needed for normal `pnpm dev`.

## Simplification gate and scope boundaries

- Use the already-installed Wrangler Quick Tunnel; do not add a tunnel client or named tunnel.
- Use one shared helper for `.dev.vars` loading, Telegram API calls, command definitions, webhook URL construction, registration, verification, redaction, and conditional cleanup. Do not maintain a second copy of the Telegram command list.
- Add the minimal public `GET /health` route so readiness has an unambiguous successful response and does not depend on the secret webhook route.
- Run migrations through the existing Wrangler command with an explicit `--local`; do not add seed/reset behavior to the runner.
- Do not add automated tests or a test framework, production webhook restoration, remote D1 access, deployment, polling mode, or changes to unrelated untracked files.
- Keep `pnpm dev:worker` as the minimal HTTP-only local Worker command, and keep `pnpm dev:tunnel` as the low-level diagnostic command without automatic Telegram registration.

## Open questions

There are no remaining product questions after clarifying the goal. The readiness contract is the agreed safe `/health` route; adding it is the minimum change needed to protect against the false `530` ready state.

One external verification constraint remains: the full Telegram/Quick Tunnel scenario requires working `BOT_TOKEN`, `WEBHOOK_SECRET`, and network access. Without them, static and local checks can be run, but a real Telegram response cannot be honestly confirmed.

## Affected areas

- `scripts/telegram-webhook.ts` — new shared helper for env loading, Telegram API, commands, webhook URL, redaction, verification, and conditional cleanup.
- `scripts/set-webhook.ts` — thin manual CLI wrapper around the helper, with required `WORKER_URL`.
- `scripts/dev.ts` — new foreground runner for migrations, the Wrangler child process, log streaming, URL extraction, readiness polling, registration, and graceful shutdown.
- `src/index.ts` — safe `GET /health` response before the secret webhook-path check.
- `package.json` — `dev`, `dev:worker`, `dev:tunnel`, and the existing manual `webhook` command.
- `.dev.vars.example` — mark `WORKER_URL` as optional and only for the manual command.
- `LOCAL_DEVELOPMENT.md` — one-command flow, fallback commands, shutdown behavior, Quick Tunnel lifetime, and local-data persistence.

## UX and runner states

Terminal output should reflect this sequence:

`validate` → `migrate local D1` → `start Wrangler` → `tunnel URL found` → `waiting for public health` → `register Telegram webhook/commands` → `verify Telegram webhook` → `READY`.

Errors should identify the stage: missing env, non-zero migration exit, Wrangler exiting before a tunnel URL, missing URL, health timeout/non-2xx response, Telegram API failure, or `getWebhookInfo` mismatch. Before successful registration, the runner must not print `READY` or call Telegram `setWebhook`.

Every line emitted by the runner or manual helper must hide the secret. In particular, a complete webhook URL must be rendered in a form such as `<origin>/webhook/[redacted]`; the secret must not appear in either the runner's own messages or forwarded Wrangler output.

## Data flow and contracts

```text
.dev.vars / process.env
        │
        ├── BOT_TOKEN, WEBHOOK_SECRET ──> shared Telegram helper
        │                                  ├── setWebhook(drop_pending_updates=true)
        │                                  ├── setMyCommands(en/ru)
        │                                  └── getWebhookInfo == runner webhook URL
        │
        └── runner
             ├── wrangler d1 migrations apply DB --local
             ├── wrangler dev --local --tunnel
             ├── parse https://*.trycloudflare.com
             └── GET <tunnel>/health until 2xx
```

The webhook URL is built as `<tunnel-origin>/webhook/<secret>` and sent to Telegram only after the health check succeeds. During shutdown, the helper first calls `getWebhookInfo`; `deleteWebhook({ drop_pending_updates: false })` is allowed only when `current_url` exactly matches the current runner URL.

## Implementation plan

1. Extract `.dev.vars` loading, the command list, a typed Telegram API call, and URL construction from `scripts/set-webhook.ts` into `scripts/telegram-webhook.ts`. Add registration with `drop_pending_updates: true`, `getWebhookInfo` verification, safe URL formatting, and conditional deletion without dropping the queue.
2. Rewrite `scripts/set-webhook.ts` as a thin wrapper over the shared helper. Preserve the requirement for `BOT_TOKEN`, `WEBHOOK_SECRET`, and `WORKER_URL` for the manual command; remove secret-path output.
3. Add a minimal `GET /health` response with HTTP 200 to the Worker while leaving the existing secret webhook-path check unchanged.
4. Implement `scripts/dev.ts`:
   - load env and validate only `BOT_TOKEN`/`WEBHOOK_SECRET`;
   - run local migrations as a child process with `--local`;
   - start Wrangler with `--local --tunnel`, forward both streams with redaction, and extract `*.trycloudflare.com`;
   - poll public `/health` with request timeouts, retries, and a clear failure; treat `530` and every other non-2xx response as not ready;
   - after readiness, call the shared registration helper and wait for exact Telegram verification;
   - remain active until Wrangler exits and handle SIGINT/SIGTERM by stopping the child process and conditionally deleting the webhook.
5. Update package scripts: point `dev` at the runner, add `dev:worker` for the raw local Worker, preserve `dev:tunnel`, and keep the manual `webhook` command.
6. Update `.dev.vars.example` and `LOCAL_DEVELOPMENT.md` to describe the two required env values, automatic migrations, temporary URLs, local data persistence, diagnostic/manual override commands, live reload, and graceful shutdown.

## Slices and dependencies

- [Slice 01: shared Telegram helper and Worker health contract](slices/01-telegram-health-contract.md) — no dependencies.
- [Slice 02: foreground local Telegram runner](slices/02-foreground-runner.md) — depends on Slice 01.
- [Slice 03: commands, env example, and documentation](slices/03-scripts-docs-config.md) — depends on Slices 01 and 02.

## Verification

Static checks:

- `pnpm typecheck`
- `git diff --check`
- inspect the diff for secrets, `--remote`, `deploy`, seed/reset behavior, and accidental changes to the user's PNG files.

Local and runtime flow:

- Run `pnpm dev` with valid env and verify that migrations use `--local`, Wrangler remains foreground, and `READY` appears only after public health and Telegram `getWebhookInfo` succeed.
- Verify that an intermediate `530` continues retrying and does not call `setWebhook`.
- Verify an unavailable or exited tunnel produces a clear error and does not register a broken webhook.
- Send a fresh `/start` in Telegram, change Worker code, wait for Wrangler reload, and send another update.
- Press `Ctrl-C`, verify the Worker exits, and verify `getWebhookInfo` no longer contains this local URL. If another process replaced the URL, verify cleanup leaves it untouched.

## Risks and edge cases

- Quick Tunnel may print its URL while returning `530` for a while; readiness must accept only a successful `/health` response.
- Wrangler may exit before a URL appears or during polling; the runner must stop without attempting registration.
- Telegram's webhook may be changed manually or by another environment; exact `current_url` comparison prevents deleting a foreign webhook.
- If commands fail after `setWebhook` succeeds, the shared cleanup path should still remove this runner's webhook.
- The secret may appear in forwarded Wrangler output or an error message; redaction must happen before output.
- Repeated runs preserve D1 and apply only pending migrations; no pending migration is a successful outcome.
- Shutdown must not pass `drop_pending_updates: true`, otherwise new messages could be lost.

## Confidence assessment

**Plan confidence: 95%.** The plan is based on the current `package.json`, `wrangler.toml`, `.dev.vars.example`, Worker entrypoint, manual webhook script, migration scripts, and the locally installed Wrangler 4.122 implementation, including its Quick Tunnel regex and log format. The task scope and data flow are defined, and the dedicated health route closes the readiness gap.

**Implementation confidence: 92%.** The implementation fits the existing TypeScript/tsx stack and requires no new dependencies. Remaining uncertainty is limited to external conditions—Telegram API availability, cloudflared download/startup, and exact signal behavior in the user's environment—which will be checked at runtime and do not change the architecture.
