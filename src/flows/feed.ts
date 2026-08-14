import { InlineKeyboard, type Context } from "grammy";
import {
  type Db,
  getUser,
  insertEvent,
  insertLike,
  insertSkip,
  isOnboarding,
  listFeedCandidates,
  listIncomingLikers,
  listSnippets,
  pickCandidate,
  type UserRecord,
} from "../db/queries";
import { distanceBetween } from "../geo";
import { renderOwnCard } from "./card";
import { processNewLike } from "./match";
import { t, type Locale } from "../t";

type FeedContext = Context & {
  db: Db;
  locale: Locale;
  executionCtx: ExecutionContext;
};

export type FeedCard = {
  html: string;
  candidateId: number;
};

export function likeSkipKeyboard(locale: Locale, candidateId: number): InlineKeyboard {
  return new InlineKeyboard()
    .text(t(locale, "feedLike"), `fd:like:${candidateId}`)
    .text(t(locale, "feedSkip"), `fd:skip:${candidateId}`);
}

export function inboxLikeSkipKeyboard(locale: Locale, candidateId: number): InlineKeyboard {
  return new InlineKeyboard()
    .text(t(locale, "feedLike"), `lk:like:${candidateId}`)
    .text(t(locale, "feedSkip"), `lk:skip:${candidateId}`);
}

export function likesOpenKeyboard(locale: Locale): InlineKeyboard {
  return new InlineKeyboard().text(t(locale, "likesOpen"), "lk:open");
}

export async function loadNextFeedCard(
  db: Db,
  viewer: UserRecord,
  nowMs: number,
): Promise<FeedCard | null> {
  let candidates = await listFeedCandidates(db, viewer);
  while (candidates.length > 0) {
    const picked = pickCandidate(viewer, candidates);
    if (!picked) return null;
    const snippets = await listSnippets(db, picked.user.id);
    if (picked.user.name !== null && picked.user.birthYear !== null && snippets.length > 0) {
      return {
        candidateId: picked.user.id,
        html: renderOwnCard({
          name: picked.user.name,
          birthYear: picked.user.birthYear,
          bio: picked.user.bio,
          city: picked.user.city,
          snippets,
          nowMs,
          distanceKm: picked.distanceKm,
        }),
      };
    }
    candidates = candidates.filter((row) => row.id !== picked.user.id);
  }
  return null;
}

export async function replyNextFeedCard(ctx: FeedContext): Promise<void> {
  if (!ctx.from) return;
  const viewer = await getUser(ctx.db, ctx.from.id);
  if (!viewer || isOnboarding(viewer)) {
    await ctx.reply(t(ctx.locale, "finishOnboardingFirst"));
    return;
  }
  const card = await loadNextFeedCard(ctx.db, viewer, Date.now());
  if (!card) {
    await ctx.reply(t(ctx.locale, "feedEmpty"));
    return;
  }
  await ctx.reply(card.html, {
    parse_mode: "HTML",
    reply_markup: likeSkipKeyboard(ctx.locale, card.candidateId),
  });
}

async function loadNextIncomingCard(
  db: Db,
  viewer: UserRecord,
  nowMs: number,
  locale: Locale,
): Promise<FeedCard | null> {
  const likers = await listIncomingLikers(db, viewer.id);
  for (const liker of likers) {
    const snippets = await listSnippets(db, liker.id);
    if (liker.name === null || liker.birthYear === null || snippets.length === 0) continue;
    return {
      candidateId: liker.id,
      html: renderOwnCard({
        name: liker.name,
        birthYear: liker.birthYear,
        bio: liker.bio,
        city: liker.city,
        snippets,
        nowMs,
        distanceKm: distanceBetween(viewer, liker),
        footer: t(locale, "likesCardHint"),
      }),
    };
  }
  return null;
}

export async function replyNextIncomingLike(ctx: FeedContext): Promise<void> {
  if (!ctx.from) return;
  const viewer = await getUser(ctx.db, ctx.from.id);
  if (!viewer || isOnboarding(viewer)) {
    await ctx.reply(t(ctx.locale, "finishOnboardingFirst"));
    return;
  }
  const card = await loadNextIncomingCard(ctx.db, viewer, Date.now(), ctx.locale);
  if (!card) {
    await ctx.reply(t(ctx.locale, "likesEmpty"));
    return;
  }
  await ctx.reply(card.html, {
    parse_mode: "HTML",
    reply_markup: inboxLikeSkipKeyboard(ctx.locale, card.candidateId),
  });
}

export async function handleLikesOpen(ctx: FeedContext): Promise<void> {
  if (ctx.callbackQuery) {
    try {
      await ctx.answerCallbackQuery();
    } catch {
      // already answered
    }
  }
  await replyNextIncomingLike(ctx);
}

export async function handleLikesAction(ctx: FeedContext): Promise<void> {
  const data = ctx.callbackQuery?.data ?? "";
  const match = /^lk:(like|skip):(\d+)$/.exec(data);
  if (!match) return;
  if (ctx.callbackQuery) {
    try {
      await ctx.answerCallbackQuery();
    } catch {
      // already answered
    }
  }
  if (!ctx.from) return;
  const viewer = await getUser(ctx.db, ctx.from.id);
  if (!viewer || isOnboarding(viewer)) {
    await ctx.reply(t(ctx.locale, "finishOnboardingFirst"));
    return;
  }
  const action = match[1];
  const toUser = Number(match[2]);
  if (Number.isFinite(toUser) && toUser !== viewer.id) {
    const inserted =
      action === "like"
        ? await insertLike(ctx.db, viewer.id, toUser)
        : await insertSkip(ctx.db, viewer.id, toUser);
    if (inserted) {
      await insertEvent(ctx.db, viewer.id, action === "like" ? "like" : "skip");
      if (action === "like") await processNewLike(ctx, viewer, toUser);
    }
  }
  await replyNextIncomingLike(ctx);
}

export async function handleFeedCommand(ctx: FeedContext): Promise<void> {
  await replyNextFeedCard(ctx);
}

export async function handleFeedCallback(ctx: FeedContext): Promise<void> {
  const data = ctx.callbackQuery?.data ?? "";
  const match = /^fd:(like|skip):(\d+)$/.exec(data);
  if (!match) return;
  if (ctx.callbackQuery) {
    try {
      await ctx.answerCallbackQuery();
    } catch {
      // already answered
    }
  }
  if (!ctx.from) return;
  const viewer = await getUser(ctx.db, ctx.from.id);
  if (!viewer || isOnboarding(viewer)) {
    await ctx.reply(t(ctx.locale, "finishOnboardingFirst"));
    return;
  }

  const action = match[1];
  const toUser = Number(match[2]);
  if (!Number.isFinite(toUser) || toUser === viewer.id) {
    await replyNextFeedCard(ctx);
    return;
  }

  const inserted =
    action === "like"
      ? await insertLike(ctx.db, viewer.id, toUser)
      : await insertSkip(ctx.db, viewer.id, toUser);
  if (inserted) {
    await insertEvent(ctx.db, viewer.id, action === "like" ? "like" : "skip");
    if (action === "like") await processNewLike(ctx, viewer, toUser);
  }
  await replyNextFeedCard(ctx);
}
