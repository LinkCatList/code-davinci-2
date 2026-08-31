# Slice 01: Shared Telegram helper and Worker health contract

## Goal

Create the shared Telegram/webhook contract and a safe public Worker readiness endpoint that later slices can use without duplicating behavior or exposing the webhook secret.

## Dependencies

None.

## Context

The current `scripts/set-webhook.ts` owns env loading, Telegram calls, command definitions, URL construction, and webhook setup in one executable file. The Worker currently accepts only the secret webhook path and has no deterministic public readiness route.

## Scope

- Add `scripts/telegram-webhook.ts` with:
  - `.dev.vars` loading while preserving process environment precedence;
  - required credential validation;
  - webhook URL construction and secret-safe formatting/redaction;
  - the existing English/Russian command definitions;
  - Telegram API calls for webhook registration, command setup, webhook verification, and conditional cleanup;
  - startup queue dropping and shutdown queue preservation as specified.
- Add `GET /health` with HTTP 200 in `src/index.ts` before the secret webhook route check.

## Non-goals

- Do not add the foreground runner or change package scripts.
- Do not change bot behavior, webhook path semantics, D1 behavior, or production configuration.
- Do not add tests or dependencies.

## Acceptance criteria

- The helper can register the existing webhook and commands without duplicating the command list.
- Registration verifies the exact Telegram `current_url`.
- Conditional cleanup deletes only the expected URL and never drops pending updates.
- No helper output contains the secret webhook path.
- `GET /health` returns HTTP 200 without initializing the bot or touching D1.

## Verification method

- Review helper calls and payloads for `drop_pending_updates` values and exact URL comparison.
- Run `pnpm typecheck` after integration with the Worker.
- Exercise the manual command in slice 03 with a safe/invalid environment to verify validation and redacted output.

