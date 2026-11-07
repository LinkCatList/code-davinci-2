import { InlineKeyboard } from "grammy";
import {
  deletePriorityInvite,
  getPriorityInvite,
  hasSkipped,
  getUser,
  insertEvent,
  insertLike,
  insertPriorityInvite,
  isOnboarding,
  listSnippets,
} from "../db/queries";
import { renderOwnCard } from "./card";
import { processNewLike } from "./match";
import { t } from "../t";
import type { OutsideContext } from "./onboarding";

export async function handlePriorityCommand(ctx: OutsideContext): Promise<void> {
  if (!ctx.from) return;
  const sender = await getUser(ctx.db, ctx.from.id);
  if (!sender || isOnboarding(sender)) {
    await ctx.reply(t(ctx.locale, "finishOnboardingFirst"));
    return;
  }
  if (sender.isPremium !== 1) {
    await ctx.reply(t(ctx.locale, "priorityPremiumOnly"));
    return;
  }
  const targetId = sender.lastCardUserId;
  if (targetId == null || targetId === sender.id) {
    await ctx.reply(t(ctx.locale, "priorityOpenCardFirst"));
    return;
  }
  const target = await getUser(ctx.db, targetId);
  if (!target || target.isActive !== 1 || target.isFake === 1 || isOnboarding(target) ||
      (await hasSkipped(ctx.db, target.id, sender.id)) ||
      (await hasSkipped(ctx.db, sender.id, target.id))) {
    await ctx.reply(t(ctx.locale, "priorityUnavailable"));
    return;
  }
  const inserted = await insertPriorityInvite(ctx.db, sender.id, target.id);
  if (!inserted) {
    await ctx.reply(t(ctx.locale, "priorityAlreadySent"));
    return;
  }
  const snippets = await listSnippets(ctx.db, sender.id);
  if (sender.name === null || sender.birthYear === null || snippets.length === 0) {
    await deletePriorityInvite(ctx.db, sender.id, target.id);
    await ctx.reply(t(ctx.locale, "priorityProfileIncomplete"));
    return;
  }
  const card = renderOwnCard({
    name: sender.name,
    birthYear: sender.birthYear,
    bio: sender.bio,
    gender: sender.gender,
    locale: target.locale === "ru" ? "ru" : "en",
    snippets,
    nowMs: Date.now(),
    header: t(target.locale, "priorityInviteHeader"),
  });
  const keyboard = new InlineKeyboard()
    .text(t(target.locale, "priorityAccept"), `pi:accept:${sender.id}`)
    .text(t(target.locale, "priorityDecline"), `pi:decline:${sender.id}`);
  try {
    await ctx.api.sendMessage(target.id, card, { parse_mode: "HTML", reply_markup: keyboard });
    await ctx.reply(t(ctx.locale, "prioritySent"));
  } catch {
    await deletePriorityInvite(ctx.db, sender.id, target.id);
    await ctx.reply(t(ctx.locale, "priorityDeliveryFailed"));
  }
}

export async function handlePriorityCallback(ctx: OutsideContext): Promise<void> {
  const data = ctx.callbackQuery?.data ?? "";
  const match = /^pi:(accept|decline):(\d+)$/.exec(data);
  if (!match || !ctx.from) return;
  try { await ctx.answerCallbackQuery(); } catch { /* already answered */ }
  const viewer = await getUser(ctx.db, ctx.from.id);
  const inviterId = Number(match[2]);
  if (!viewer || viewer.isActive !== 1 || isOnboarding(viewer) || !(await getPriorityInvite(ctx.db, inviterId, viewer.id))) {
    await ctx.reply(t(ctx.locale, "priorityInviteExpired"));
    return;
  }
  await deletePriorityInvite(ctx.db, inviterId, viewer.id);
  if (match[1] === "decline") {
    await ctx.reply(t(ctx.locale, "priorityDeclined"));
    const inviter = await getUser(ctx.db, inviterId);
    if (inviter) await ctx.api.sendMessage(inviter.id, t(inviter.locale, "priorityDeclinedNotice")).catch(() => undefined);
    return;
  }
  const inviter = await getUser(ctx.db, inviterId);
  if (!inviter || inviter.isActive !== 1 || inviter.isFake === 1 || viewer.isFake === 1 ||
      (await hasSkipped(ctx.db, viewer.id, inviter.id)) ||
      (await hasSkipped(ctx.db, inviter.id, viewer.id))) {
    await ctx.reply(t(ctx.locale, "priorityInviteExpired"));
    return;
  }
  await insertLike(ctx.db, inviter.id, viewer.id);
  await insertLike(ctx.db, viewer.id, inviter.id);
  await insertEvent(ctx.db, viewer.id, "like");
  await processNewLike(ctx, viewer, inviter.id);
  await ctx.reply(t(ctx.locale, "priorityAccepted"));
}
