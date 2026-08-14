import { GrammyError, InlineKeyboard, type Api, type Context } from "grammy";
import {
  type Db,
  type MatchRecord,
  type UserRecord,
  getUser,
  hasReciprocalLike,
  insertEvent,
  insertMatch,
  listMatchesForUser,
  listSnippets,
  claimLikeDigest,
  setMatchRevealed,
  setUserInactive,
} from "../db/queries";
import { renderOwnCard } from "./card";
import { distanceBetween } from "../geo";
import { isLocale, t, type Locale } from "../t";

type MatchContext = Context & {
  db: Db;
  executionCtx: ExecutionContext;
  locale: Locale;
};

function localeOf(user: UserRecord): Locale {
  return isLocale(user.locale) ? user.locale : "en";
}

function isBlocked(error: unknown): boolean {
  return error instanceof GrammyError && error.error_code === 403;
}

async function safeSend(api: Api, db: Db, chatId: number, send: () => Promise<unknown>): Promise<boolean> {
  try {
    await send();
    return true;
  } catch (error) {
    if (isBlocked(error)) await setUserInactive(db, chatId);
    return false;
  }
}

async function sendReveal(
  api: Api,
  db: Db,
  to: UserRecord,
  viewer: UserRecord,
  other: UserRecord,
  nowMs: number,
): Promise<boolean> {
  if (to.isActive !== 1 || !other.username) return false;
  const locale = localeOf(to);
  const snippets = await listSnippets(db, other.id);
  const html = renderOwnCard({
    name: other.name ?? "",
    birthYear: other.birthYear ?? 0,
    bio: other.bio,
    city: other.city,
    snippets,
    nowMs,
    distanceKm: distanceBetween(viewer, other),
    includeAllSnippets: true,
    header: t(locale, "matchTitle"),
    footer: `https://t.me/${other.username}`,
  });
  return safeSend(api, db, to.id, () => api.sendMessage(to.id, html, { parse_mode: "HTML" }));
}

async function revealIfPossible(
  api: Api,
  db: Db,
  match: MatchRecord,
  recipient: UserRecord,
  other: UserRecord,
  recipientIsA: boolean,
  nowMs: number,
): Promise<void> {
  const already = recipientIsA ? match.revealedA === 1 : match.revealedB === 1;
  if (already || !other.username || recipient.isActive !== 1) return;
  const sent = await sendReveal(api, db, recipient, recipient, other, nowMs);
  if (sent) await setMatchRevealed(db, match.id, recipientIsA ? "a" : "b");
}

export async function processNewLike(
  ctx: MatchContext,
  fromUser: UserRecord,
  toUserId: number,
): Promise<void> {
  const toUser = await getUser(ctx.db, toUserId);
  if (!toUser) return;

  if (await hasReciprocalLike(ctx.db, fromUser.id, toUserId)) {
    const created = await insertMatch(ctx.db, fromUser.id, toUserId);
    if (!created) return;
    await insertEvent(ctx.db, fromUser.id, "match");
    const nowMs = Date.now();
    await revealIfPossible(ctx.api, ctx.db, created, fromUser, toUser, created.userA === fromUser.id, nowMs);
    await revealIfPossible(ctx.api, ctx.db, created, toUser, fromUser, created.userA === toUser.id, nowMs);

    if (!toUser.username && fromUser.isActive === 1) {
      await safeSend(ctx.api, ctx.db, fromUser.id, () =>
        ctx.api.sendMessage(fromUser.id, t(localeOf(fromUser), "matchPendingViewer")),
      );
    }
    if (!fromUser.username && toUser.isActive === 1) {
      await safeSend(ctx.api, ctx.db, toUser.id, () =>
        ctx.api.sendMessage(toUser.id, t(localeOf(toUser), "matchPendingViewer")),
      );
    }
    if (!fromUser.username && fromUser.isActive === 1) {
      await safeSend(ctx.api, ctx.db, fromUser.id, () =>
        ctx.api.sendMessage(fromUser.id, t(localeOf(fromUser), "matchPendingOther")),
      );
    }
    if (!toUser.username && toUser.isActive === 1) {
      await safeSend(ctx.api, ctx.db, toUser.id, () =>
        ctx.api.sendMessage(toUser.id, t(localeOf(toUser), "matchPendingOther")),
      );
    }
    return;
  }

  const digest = ctx.executionCtx.waitUntil(
    (async () => {
      const claimed = await claimLikeDigest(ctx.db, toUserId);
      if (!claimed) return;
      const locale = isLocale(claimed.locale) ? claimed.locale : "en";
      await safeSend(ctx.api, ctx.db, toUserId, () =>
        ctx.api.sendMessage(toUserId, t(locale, "likeDigest", { n: claimed.n }), {
          reply_markup: new InlineKeyboard().text(t(locale, "likesOpen"), "lk:open"),
        }),
      );
    })(),
  );
  void digest;
}

export async function flushPendingReveals(ctx: MatchContext): Promise<void> {
  if (!ctx.from) return;
  const me = await getUser(ctx.db, ctx.from.id);
  if (!me) return;
  const pairs = await listMatchesForUser(ctx.db, me.id);
  const nowMs = Date.now();
  for (const { match, other, meIsA } of pairs) {
    await revealIfPossible(ctx.api, ctx.db, match, me, other, meIsA, nowMs);
    await revealIfPossible(ctx.api, ctx.db, match, other, me, !meIsA, nowMs);
  }
}
