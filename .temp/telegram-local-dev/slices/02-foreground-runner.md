# Slice 02: Foreground local Telegram runner

## Goal

Implement the process runner that starts the local-only stack, waits for a genuinely reachable public Worker, configures Telegram through the shared helper, streams logs, and cleans up safely on shutdown.

## Dependencies

- Slice 01: shared Telegram helper and `/health` route.

## Context

Wrangler 4.122 starts the local Worker and Quick Tunnel in one child process and prints a `https://*.trycloudflare.com` URL. That URL can return `530` before the public proxy reaches the Worker, so URL extraction must be followed by a real public health poll.

## Scope

- Add `scripts/dev.ts` with:
  - validation of `BOT_TOKEN` and `WEBHOOK_SECRET`;
  - local-only pending migration execution;
  - Wrangler `dev --local --tunnel` child-process management;
  - redacted stdout/stderr streaming and Quick Tunnel URL extraction;
  - retrying public `GET /health` with request timeout and a clear terminal failure;
  - shared webhook registration/command setup only after readiness;
  - exact Telegram webhook verification before `READY`;
  - SIGINT/SIGTERM handling, child shutdown, and conditional webhook cleanup.

## Non-goals

- Do not deploy, use remote D1, seed/reset data, restore a production webhook, or switch to polling.
- Do not add a second Telegram API implementation.
- Do not alter `pnpm` scripts or documentation in this slice.
- Do not add tests or dependencies.

## Acceptance criteria

- The runner cannot call `setWebhook` before a successful public `/health` 2xx response.
- An intermediate `530`, network error, or unavailable tunnel is retried or fails clearly without registering a broken webhook.
- `READY` is printed only after health and Telegram verification succeed.
- Wrangler logs remain visible and the secret is redacted from forwarded output.
- Graceful shutdown preserves newly queued Telegram updates and does not delete a webhook that no longer belongs to this runner.

## Verification method

- Run the runner through `pnpm exec tsx scripts/dev.ts` with valid credentials when external access is available.
- Inspect command arguments for explicit `--local` on both migration and Worker processes.
- Observe startup, live reload, Ctrl-C shutdown, and Telegram webhook state.
- Use an unavailable/early `530` tunnel condition to confirm no registration occurs before readiness.

