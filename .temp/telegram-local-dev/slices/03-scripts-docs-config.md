# Slice 03: Commands, env example, and local-development documentation

## Goal

Expose the runner as the default one-command workflow while preserving clear low-level and manual alternatives.

## Dependencies

- Slice 01: shared helper and health contract.
- Slice 02: foreground runner.

## Context

The current package scripts do not provide a complete Telegram-local flow, `.dev.vars.example` suggests `WORKER_URL` as a normal setting, and `LOCAL_DEVELOPMENT.md` requires several manual terminals.

## Scope

- Rewrite `scripts/set-webhook.ts` as a thin wrapper over the shared helper while retaining required `WORKER_URL` validation.
- Update `package.json`:
  - `dev` → foreground runner;
  - `dev:worker` → raw `wrangler dev --local`;
  - preserve `dev:tunnel` as the low-level `wrangler dev --local --tunnel` command;
  - preserve `webhook` as the explicit manual override.
- Update `.dev.vars.example` to show only `BOT_TOKEN` and `WEBHOOK_SECRET` as required and `WORKER_URL` as optional/manual-only.
- Update `LOCAL_DEVELOPMENT.md` for one-command setup, automatic local migrations, temporary Quick Tunnel URLs, live reload, graceful shutdown, and manual/diagnostic fallbacks.

## Non-goals

- Do not change deploy or remote migration commands.
- Do not modify unrelated untracked files, including PNG assets.
- Do not add tests or dependencies.

## Acceptance criteria

- A developer can copy `.dev.vars.example`, fill two values, and use `pnpm dev` as the normal workflow.
- `pnpm webhook` still requires `WORKER_URL` and does not print the secret path.
- `pnpm dev:worker` and `pnpm dev:tunnel` retain their documented HTTP-only/diagnostic purposes.
- Documentation accurately states local data is preserved and shutdown does not drop newly queued messages.

## Verification method

- Run `pnpm typecheck` and `git diff --check`.
- Inspect `package.json`, env example, and docs against the accepted command flow.
- Run the manual command with missing `WORKER_URL` and confirm it fails with a clear validation message.

