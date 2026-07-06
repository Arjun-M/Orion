import { Composer } from "grammy";
import type { Context, NextFunction } from "grammy";
import type { Message, ChatMemberUpdated } from "grammy/types";
import { pick } from "../utils/texts.js";
import {
  requireGroup,
  escapeHtml,
} from "../utils/helpers.js";
import { fetchAndCacheAdmins } from "../utils/permissions.js";
import {
  getGroupSettings,
  saveGroupSetting,
  getApprovedUsers,
  approveUser,
  unapproveUser,
  getAntiChannel,
  getAntiLinked,
  listFilters,
  getBlacklistWords,
  getLocks,
  LOCKABLE_FIELDS,
  getWarns,
  addWarn,
  resetWarns,
  getStickerBlacklist,
  getWarnFilters,
} from "../database/models.js";

export const composer = new Composer<Context>();

export const modName = "Camp";

export const helpText =
  "I manage trusted allies who bypass locks, filters, and blacklists. " +
  "Approved users are immune to automated moderation.\n\n" +
  "<b>Trusted Allies (Approve):</b>\n" +
  "• <code>/approve &lt;user&gt;</code> — Mark as trusted\n" +
  "• <code>/unapprove &lt;user&gt;</code> — Revoke trust\n" +
  "• <code>/approved</code> — List trusted allies\n\n" +
  "<b>Info:</b>\n" +
  "• <code>/settings</code> — View camp configuration\n" +
  "• <code>/markdownhelp</code> — Markdown & button formatting guide\n\n" +
  "<b>How it works:</b> Approved users are stored per-group and bypass all filter, blacklist, lock, and flood checks. " +
  "Use <code>/approve</code> to trust a user who needs to post links, stickers, or media without restriction.";

function commandName(text: string): string {
  return text.split(/\s+/)[0].toLowerCase().split("@", 1)[0];
}

const floodWindows = new Map<string, number[]>();

async function deleteQuietly(ctx: Context, chatId: number, messageId: number): Promise<void> {
  try {
    await ctx.api.deleteMessage(chatId, messageId);
  } catch {
    // ignore missing delete permissions
  }
}

async function applyModerationAction(
  ctx: Context,
  msg: Message,
  action: string,
  reason: string,
): Promise<boolean> {
  const user = msg.from;
  if (!user) return false;
  const chatId = msg.chat.id;
  const normalized = action.toLowerCase();

  if (normalized === "nothing") return false;
  if (["delete", "warn", "mute", "kick", "ban", "tban", "tmute"].includes(normalized)) {
    await deleteQuietly(ctx, chatId, msg.message_id);
  }
  if (normalized === "delete") return true;

  if (normalized === "warn") {
    await addWarn(user.id, chatId, reason, ctx.from?.id ?? null);
    const warns = await getWarns(user.id, chatId);
    const settings = await getGroupSettings(chatId);
    const limit = (settings.warn_limit as number) || 3;
    if (warns.length >= limit) {
      await ctx.api.banChatMember(chatId, user.id);
      await ctx.reply(`<b>${escapeHtml(user.first_name)}</b> has been cast out. Too many arrows find their mark.`);
    } else {
      await ctx.reply(`<b>${escapeHtml(user.first_name)}</b> warned: <i>${escapeHtml(reason)}</i> (<b>${warns.length}</b>/${limit})`);
    }
    return true;
  }

  if (normalized === "mute" || normalized === "tmute") {
    const until = normalized === "tmute" ? { until_date: Math.floor(Date.now() / 1000) + 3600 } : undefined;
    await ctx.api.restrictChatMember(chatId, user.id, { can_send_messages: false }, until);
    return true;
  }
  if (normalized === "kick") {
    await ctx.api.banChatMember(chatId, user.id);
    await ctx.api.unbanChatMember(chatId, user.id);
    return true;
  }
  if (normalized === "ban" || normalized === "tban") {
    const options = normalized === "tban" ? { until_date: Math.floor(Date.now() / 1000) + 3600 } : undefined;
    await ctx.api.banChatMember(chatId, user.id, options);
    return true;
  }
  return false;
}

function lockMatches(msg: Message, lock: string): boolean {
  const m = msg as any;
  if (lock === "messages") return !!msg.text && !msg.text.startsWith("/");
  if (lock === "audio") return !!m.audio;
  if (lock === "voice") return !!m.voice;
  if (lock === "document") return !!m.document;
  if (lock === "video") return !!m.video;
  if (lock === "contact") return !!m.contact;
  if (lock === "photo") return !!m.photo;
  if (lock === "sticker") return !!m.sticker;
  if (lock === "gif") return !!m.animation;
  if (lock === "game") return !!m.game;
  if (lock === "location") return !!m.location || !!m.venue;
  if (lock === "poll") return !!m.poll;
  if (lock === "pin") return !!m.pinned_message;
  if (lock === "forward") return !!m.forward_origin || !!m.forward_from || !!m.forward_from_chat;
  if (lock === "bots") return Array.isArray(m.new_chat_members) && m.new_chat_members.some((u: any) => u.is_bot);
  if (lock === "inline") return !!m.via_bot;
  if (lock === "url" || lock === "button" || lock === "previews") {
    return (msg.entities || []).some((e) => e.type === "url" || e.type === "text_link") || !!m.reply_markup;
  }
  if (lock === "invite") {
    const text = msg.text || msg.caption || "";
    return /(t\.me\/joinchat|t\.me\/\+|telegram\.me\/joinchat)/i.test(text);
  }
  if (lock === "rtl") return /[\u0590-\u08FF]/.test(msg.text || msg.caption || "");
  if (lock === "media") return !!(m.photo || m.video || m.document || m.audio || m.voice || m.sticker || m.animation);
  if (lock === "other") return !msg.text;
  return false;
}

async function enforceFlood(ctx: Context, msg: Message, settings: Record<string, unknown>): Promise<boolean> {
  if (!msg.from || msg.chat.type === "private") return false;
  const limit = Number(settings.flood_limit || 0);
  if (!limit || limit < 2) return false;
  const key = `${msg.chat.id}:${msg.from.id}`;
  const now = Date.now();
  const windowStart = now - 10000;
  const stamps = (floodWindows.get(key) || []).filter((ts) => ts >= windowStart);
  stamps.push(now);
  floodWindows.set(key, stamps);
  if (stamps.length <= limit) return false;
  floodWindows.set(key, []);
  return await applyModerationAction(ctx, msg, (settings.flood_action as string) || "mute", "Flooding");
}

// ── Approve ──

composer.command("approve", async (ctx: Context) => {
  const msg = ctx.message as Message;
  if (!msg || !(await requireGroup(ctx))) return;
  const target = msg.reply_to_message?.from;
  if (!target) {
    await ctx.reply("Reply to someone I should trust.");
    return;
  }
  await approveUser(msg.chat.id, target.id);
  await ctx.reply(`<b>${target.first_name}</b> is now a trusted ally.`);
});

composer.command("unapprove", async (ctx: Context) => {
  const msg = ctx.message as Message;
  if (!msg || !(await requireGroup(ctx))) return;
  const target = msg.reply_to_message?.from;
  if (!target) {
    await ctx.reply("Reply to someone to revoke their trusted status.");
    return;
  }
  await unapproveUser(msg.chat.id, target.id);
  await ctx.reply(`<b>${target.first_name}</b> is no longer trusted.`);
});

composer.command("approved", async (ctx: Context) => {
  const msg = ctx.message as Message;
  if (!msg || !(await requireGroup(ctx))) return;
  const approved = await getApprovedUsers(msg.chat.id);
  if (approved.length > 0) {
    const lines = [`<b>${approved.length} trusted allies:</b>`];
    for (const a of approved) {
      try {
        const u = await ctx.api.getChat(a.user_id as number);
        lines.push(`• ${"first_name" in u ? u.first_name : a.user_id}`);
      } catch {
        lines.push(`• <code>${a.user_id}</code>`);
      }
    }
    await ctx.reply(lines.join("\n"));
  } else {
    await ctx.reply("No trusted allies in this camp.");
  }
});

// ── Message Auto-Triggers ──

composer.on("message", async (ctx: Context, next: NextFunction) => {
  const msg = ctx.message as Message;
  if (!msg || msg.chat.type === "private") {
    await next();
    return;
  }

  const text = msg.text || msg.caption || "";
  const isCommandMessage = text.startsWith("/");
  const chatId = msg.chat.id;
  const settings = await getGroupSettings(chatId);

  const antiChannel = await getAntiChannel(chatId);
  const antiLinked = await getAntiLinked(chatId);
  if ((antiChannel.enabled || antiLinked.enabled) && ((msg as any).sender_chat || (msg as any).is_automatic_forward)) {
    await deleteQuietly(ctx, chatId, msg.message_id);
    return;
  }
  if ((antiLinked.anti_pin || settings.clean_service) && (msg as any).pinned_message) {
    await deleteQuietly(ctx, chatId, msg.message_id);
    return;
  }

  if (!isCommandMessage) {
    const locks = await getLocks(chatId);
    for (const lock of LOCKABLE_FIELDS) {
      if (locks[lock] && lockMatches(msg, lock)) {
        await deleteQuietly(ctx, chatId, msg.message_id);
        return;
      }
    }

    if ((msg as any).sticker) {
      const banned = await getStickerBlacklist(chatId);
      const fileId = (msg as any).sticker.file_id;
      if (banned.some((s) => s.trigger === fileId)) {
        const handled = await applyModerationAction(
          ctx,
          msg,
          (settings.sticker_blacklist_action as string) || "delete",
          "Blacklisted sticker",
        );
        if (handled) return;
      }
    }

    if (await enforceFlood(ctx, msg, settings)) return;
  }

  await next();
});

composer.on("message:text", async (ctx: Context, next: NextFunction) => {
  const msg = ctx.message as Message;
  if (!msg || msg.chat.type === "private") {
    await next();
    return;
  }
  const text = msg.text || "";
  if (!text || text.startsWith("/")) {
    await next();
    return;
  }

  const chatId = msg.chat.id;
  const settings = await getGroupSettings(chatId);
  const cfs = await listFilters(chatId);
  const words = await getBlacklistWords(chatId);
  const warnFilters = await getWarnFilters(chatId);

  const blAction = (settings.blacklist_action as string) || "delete";
  for (const w of words) {
    if (text.toLowerCase().includes((w.word as string).toLowerCase())) {
      const handled = await applyModerationAction(ctx, msg, blAction, `Blacklisted word: ${w.word as string}`);
      if (handled) return;
    }
  }

  for (const wf of warnFilters) {
    if (text.toLowerCase().includes((wf.keyword as string).toLowerCase())) {
      await addWarn(msg.from!.id, chatId, `Auto-warn: ${wf.keyword as string}`, ctx.from?.id ?? null);
      const warns = await getWarns(msg.from!.id, chatId);
      const limit = (settings.warn_limit as number) || 3;
      if (warns.length >= limit) {
        await ctx.api.banChatMember(chatId, msg.from!.id);
        await ctx.reply(`<b>${escapeHtml(msg.from!.first_name)}</b> has been cast out. Too many arrows find their mark.`);
      } else {
        await ctx.reply(`<b>${escapeHtml(msg.from!.first_name)}</b> warned: <i>Auto-warn</i> (<b>${warns.length}</b>/${limit})`);
      }
      return;
    }
  }

  for (const cf of cfs) {
    if (text.toLowerCase().includes((cf.keyword as string).toLowerCase())) {
      const user = msg.from!;
      const kw: Record<string, string | number> = {
        first: user.first_name || "",
        last: user.last_name || "",
        fullname: `${user.first_name || ""} ${user.last_name || ""}`.trim(),
        username: user.username ? `@${user.username}` : "",
        mention: `<a href="tg://user?id=${user.id}">${escapeHtml(user.first_name || "User")}</a>`,
        id: user.id,
        chatname: msg.chat.title || "this camp",
      };
      let content = (cf.content as string) || "";
      try {
        content = content.replace(/\{(\w+)\}/g, (_, key) => String(kw[key] ?? `{${key}}`));
      } catch {
        // ignore
      }
      const [clean] = await (await import("../utils/helpers.js")).parseButtonMarkdown(content);
      await ctx.reply(clean);
      return;
    }
  }
  await next();
});
