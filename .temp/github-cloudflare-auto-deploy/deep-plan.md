# GitHub-to-Cloudflare Production Deployments

## Goal

Deploy the `code-davinci` Cloudflare Worker automatically after each push to `master`, while keeping production credentials and Telegram secrets outside the repository.

## Workflow Contract

- The `Deploy to Cloudflare` workflow deploys only the `master` ref: on pushes to `master` and through manual dispatch when `master` is selected.
- The job uses the GitHub `production` Environment and serializes releases in the `code-davinci-production` concurrency group.
- It installs the lockfile dependencies, runs `pnpm typecheck`, applies pending migrations with `pnpm db:migrate:remote`, then deploys with `pnpm deploy`.
- `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` are provided only to the remote-migration and deployment steps.

## One-Time Configuration

1. Create a GitHub Environment named `production` without required reviewers.
2. Add `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` as Environment secrets.
3. Scope the Cloudflare token to the target account with Workers edit and D1 edit permissions.
4. Confirm that the deployed Worker already has its `BOT_TOKEN` and `WEBHOOK_SECRET` secrets configured in Cloudflare. This workflow never reads, writes, or logs them.
5. If this is the first production deployment, configure Telegram's webhook once using the deployed Worker's stable public URL.

## Constraints

- Remote D1 migrations must remain backward-compatible with the previously deployed Worker. Destructive or data-transforming migrations require a separately reviewed release.
- The workflow does not deploy branches other than `master`, create a staging environment, change the Worker/D1 configuration, or alter Telegram webhook behavior.
- No test files are added; `pnpm typecheck` is the CI gate for this change.

## Verification

1. Push a type-correct change to `master` and confirm the GitHub run finishes in the order: typecheck, remote migrations, Worker deploy.
2. Re-run the workflow manually from `master` and confirm it succeeds when no D1 migrations are pending; a run selected from another branch must skip the production job.
3. Confirm the deployed Worker's `/health` endpoint responds and send a real Telegram update through the production webhook.
