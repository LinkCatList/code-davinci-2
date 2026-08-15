import {
  getUser,
  insertEvent,
  insertLike,
  insertSkip,
  isOnboarding,
  listFeedCandidates,
  listIncomingLikers,
  listSnippets,
  pickCandidate,
  resumeUser,
  setBrowseState,
  type UserRecord,
} from "../db/queries";
import { distanceBetween } from "../geo";
import { browseKeyboard, homeKeyboard } from "../keyboards";
import { t } from "../t";
import { renderOwnCard } from "./card";
import { flushPendingReveals, processNewLike } from "./match";
import type { OutsideContext } from "./onboarding";
import { isPausedUser, replyHome, replyPaused } from "./screens";

export type FeedCard = {
  html: string;
  candidateId: number;
};

async function loadNextFeedCard(
  db: OutsideContext["db"],
  viewer: UserRecord,
  nowMs: number,
  locale: OutsideContext["locale"],
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
          gender: picked.user.gender,
          locale,
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

async function loadNextIncomingCard(
  db: OutsideContext["db"],
  viewer: UserRecord,
  nowMs: number,
  locale: OutsideContext["locale"],
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
        gender: liker.gender,
        locale,
        snippets,
        nowMs,
        distanceKm: distanceBetween(viewer, liker),
        header: t(locale, "likesCardHint"),
      }),
    };
  }
  return null;
}

async function sendCard(
  ctx: OutsideContext,
  card: FeedCard,
  mode: "feed" | "inbox",
): Promise<void> {
  if (!ctx.from) return;
  await setBrowseState(ctx.db, ctx.from.id, mode, card.candidateId);
  await ctx.reply(card.html, {
    parse_mode: "HTML",
    reply_markup: browseKeyboard(ctx.locale),
  });
}

async function sendEmpty(
  ctx: OutsideContext,
  key: "feedEmpty" | "likesEmpty",
): Promise<void> {
  if (!ctx.from) return;
  await setBrowseState(ctx.db, ctx.from.id, "home", null);
  await ctx.reply(t(ctx.locale, key), { reply_markup: homeKeyboard(ctx.locale) });
}

export async function replyNextFeedCard(ctx: OutsideContext): Promise<void> {
  if (!ctx.from) return;
  const viewer = await getUser(ctx.db, ctx.from.id);
  if (!viewer || isOnboarding(viewer)) {
    await ctx.reply(t(ctx.locale, "finishOnboardingFirst"));
    return;
  }
  const card = await loadNextFeedCard(ctx.db, viewer, Date.now(), ctx.locale);
  if (!card) {
    await sendEmpty(ctx, "feedEmpty");
    return;
  }
  await sendCard(ctx, card, "feed");
}

export async function replyNextIncomingLike(ctx: OutsideContext): Promise<void> {
  if (!ctx.from) return;
  const viewer = await getUser(ctx.db, ctx.from.id);
  if (!viewer || isOnboarding(viewer)) {
    await ctx.reply(t(ctx.locale, "finishOnboardingFirst"));
    return;
  }
  if (isPausedUser(viewer)) {
    await replyPaused(ctx);
    return;
  }
  const card = await loadNextIncomingCard(ctx.db, viewer, Date.now(), ctx.locale);
  if (!card) {
    await sendEmpty(ctx, "likesEmpty");
    return;
  }
  await sendCard(ctx, card, "inbox");
}

export async function applySwipe(
  ctx: OutsideContext,
  viewer: UserRecord,
  toUser: number,
  action: "like" | "skip",
): Promise<"match" | "swiped" | "ignored"> {
  if (!Number.isFinite(toUser) || toUser === viewer.id) return "ignored";
  const inserted =
    action === "like"
      ? await insertLike(ctx.db, viewer.id, toUser)
      : await insertSkip(ctx.db, viewer.id, toUser);
  if (!inserted) return "ignored";
  await insertEvent(ctx.db, viewer.id, action === "like" ? "like" : "skip");
  if (action === "like") {
    const matched = await processNewLike(ctx, viewer, toUser);
    if (matched) return "match";
  }
  return "swiped";
}

async function continueAfterSwipe(
  ctx: OutsideContext,
  mode: "feed" | "inbox",
  result: "match" | "swiped" | "ignored",
): Promise<void> {
  if (result === "match") return;
  if (mode === "inbox") await replyNextIncomingLike(ctx);
  else await replyNextFeedCard(ctx);
}

export async function handleBrowseAction(
  ctx: OutsideContext,
  action: "like" | "skip" | "sleep",
): Promise<void> {
  if (!ctx.from) return;
  const viewer = await getUser(ctx.db, ctx.from.id);
  if (!viewer || isOnboarding(viewer)) {
    await ctx.reply(t(ctx.locale, "finishOnboardingFirst"));
    return;
  }
  if (isPausedUser(viewer)) {
    await replyPaused(ctx);
    return;
  }
  if (action === "sleep") {
    await replyHome(ctx);
    return;
  }
  const target = viewer.lastCardUserId;
  if (target == null) {
    await setBrowseState(ctx.db, viewer.id, "home", null);
    await ctx.reply(t(ctx.locale, "openCardsFirst"), { reply_markup: homeKeyboard(ctx.locale) });
    return;
  }
  const mode = viewer.browseMode === "inbox" ? "inbox" : "feed";
  const result = await applySwipe(ctx, viewer, target, action);
  await continueAfterSwipe(ctx, mode, result);
}

export async function handleLikesOpen(ctx: OutsideContext): Promise<void> {
  if (ctx.callbackQuery) {
    try {
      await ctx.answerCallbackQuery();
    } catch {
      // already answered
    }
  }
  await replyNextIncomingLike(ctx);
}

export async function handleLikesAction(ctx: OutsideContext): Promise<void> {
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
  if (isPausedUser(viewer)) {
    await replyPaused(ctx);
    return;
  }
  const action = match[1] === "like" ? "like" : "skip";
  const result = await applySwipe(ctx, viewer, Number(match[2]), action);
  await continueAfterSwipe(ctx, "inbox", result);
}

export async function handleFeedCommand(ctx: OutsideContext): Promise<void> {
  if (!ctx.from) return;
  const viewer = await getUser(ctx.db, ctx.from.id);
  if (!viewer || isOnboarding(viewer)) {
    await ctx.reply(t(ctx.locale, "finishOnboardingFirst"));
    return;
  }
  if (viewer.isActive !== 1) {
    await resumeUser(ctx.db, viewer.id);
    await flushPendingReveals(ctx);
  }
  await replyNextFeedCard(ctx);
}

export async function handleFeedCallback(ctx: OutsideContext): Promise<void> {
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
  if (isPausedUser(viewer)) {
    await replyPaused(ctx);
    return;
  }
  const action = match[1] === "like" ? "like" : "skip";
  const result = await applySwipe(ctx, viewer, Number(match[2]), action);
  await continueAfterSwipe(ctx, "feed", result);
}
