import { Composer } from "grammy";
import type { Context, NextFunction } from "grammy";
import type { Message, ChatMemberUpdated } from "grammy/types";
import {
  WELCOME_TEXTS,
  GOODBYE_TEXTS,
  RULES_TEXTS,
  NO_RULES_TEXTS,
  pick,
} from "../utils/texts.js";
import {
  parseButtonMarkdown,
  buildKeyboard,
  requireGroup,
  escapeHtml,
} from "../utils/helpers.js";
import { fetchAndCacheAdmins } from "../utils/permissions.js";
import {
  getGroupSettings,
  saveGroupSetting,
  getStickerBlacklist,
  addStickerBlacklist,
  removeStickerBlacklist,
  getApprovedUsers,
  approveUser,
  unapproveUser,
  getAntiChannel,
  toggleAntiChannel,
  getAntiLinked,
  toggleAntiLinked,
  toggleAntiPin,
  getWarnFilters,
  addWarnFilter,
  removeWarnFilter,
  getWarns,
  addWarn,
  resetWarns,
  listFilters,
  getBlacklistWords,
  getLocks,
  LOCKABLE_FIELDS,
} from "../database/models.js";
import { cacheDelete } from "../database/cache.js";

export const composer = new Composer<Context>();

export const modName = "Camp";

export const helpText =
  "I manage the daily life of your camp — welcomes, laws, trusted allies, and more.\n\n" +
  "<b>Greetings:</b>\n" +
  "• <code>/welcome [on/off]</code> — Toggle or view welcome messages\n" +
  "• <code>/setwelcome &lt;text&gt;</code> — Carve a welcome message\n" +
  "• <code>/resetwelcome</code> — Return to the old ways\n" +
  "• <code>/goodbye [on/off]</code> — Toggle or view farewell\n" +
  "• <code>/setgoodbye &lt;text&gt;</code> — Carve a farewell\n" +
  "• <code>/resetgoodbye</code> — Return to the old ways\n" +
  "• <code>/welcomemute &lt;mode&gt;</code> — Guard mode: off/soft/strong/captcha\n" +
  "• <code>/cleanwelcome</code> — Auto-delete old welcomes\n" +
  "• <code>/cleanservice</code> — Clean join/leave notices\n\n" +
  "Welcome variables: <code>{first}</code>, <code>{last}</code>, <code>{fullname}</code>, <code>{username}</code>, <code>{mention}</code>, <code>{id}</code>, <code>{count}</code>, <code>{chatname}</code>\n\n" +
  "<b>Laws (Rules):</b>\n" +
  "• <code>/rules</code> — Read the camp's laws\n" +
  "• <code>/setrules &lt;text&gt;</code> — Write the laws\n" +
  "• <code>/clearrules</code> — Erase them\n\n" +
  "<b>Trusted Allies (Approve):</b>\n" +
  "• <code>/approve &lt;user&gt;</code> — Mark as trusted\n" +
  "• <code>/unapprove &lt;user&gt;</code> — Revoke trust\n" +
  "• <code>/approved</code> — List trusted allies\n\n" +
  "<b>Arrow Filters (Auto-Warn):</b>\n" +
  "• <code>/addwarn &lt;keyword&gt;</code> — Auto-warn on keyword\n" +
  "• <code>/nowarn &lt;keyword&gt;</code> — Remove auto-warn\n" +
  "• <code>/warnlist</code> — List auto-warn keywords\n" +
  "• <code>/warnlimit &lt;n&gt;</code> — Set arrow limit (min 3)\n\n" +
  "<b>Banned Trophies (Sticker Blacklist):</b>\n" +
  "• <code>/addblsticker</code> — Ban a replied sticker\n" +
  "• <code>/unblsticker</code> — Unban a replied sticker\n" +
  "• <code>/blsticker</code> — List banned stickers\n" +
  "• <code>/blstickermode &lt;action&gt;</code> — Set sticker punishment\n\n" +
  "<b>Other:</b>\n" +
  "• <code>/antichannel</code> — Toggle channel silence\n" +
  "• <code>/antilinked</code> — Toggle anti-linked channel\n" +
  "• <code>/antipin</code> — Toggle anti-pin\n" +
  "• <code>/logchannel &lt;id&gt;</code> — Set logging channel\n" +
  "• <code>/unlinklog</code> — Remove logging channel\n" +
  "• <code>/markdownhelp</code> — Markdown & button formatting guide";

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

async function sendWelcome(ctx: Context, chatId: number, chatName: string, user: { id: number; first_name?: string; last_name?: string; username?: string }, serviceMessageId?: number): Promise<void> {
  const settings = await getGroupSettings(chatId);
  if (settings.clean_service && serviceMessageId) {
    try {
      await ctx.api.deleteMessage(chatId, serviceMessageId);
    } catch {
      // ignore missing delete permissions
    }
  }
  if (!settings.welcome_enabled) return;

  const previousWelcomeId = settings.last_welcome_message_id as number | undefined;
  if (settings.clean_welcome && previousWelcomeId) {
    try {
      await ctx.api.deleteMessage(chatId, previousWelcomeId);
    } catch {
      // ignore stale message ids or missing permissions
    }
  }

  const memberCount = await ctx.api.getChatMemberCount(chatId);
  const kw: Record<string, string | number> = {
    first: user.first_name || "",
    last: user.last_name || "",
    fullname: `${user.first_name || ""} ${user.last_name || ""}`.trim(),
    username: user.username ? `@${user.username}` : "",
    mention: `<a href="tg://user?id=${user.id}">${escapeHtml(user.first_name || "User")}</a>`,
    id: user.id,
    count: memberCount,
    chatname: chatName || "this camp",
  };
  let msg = (settings.welcome_message as string) ||
    pick(WELCOME_TEXTS, { first: kw.first as string, count: kw.count as number });
  try {
    msg = msg.replace(/\{(\w+)\}/g, (_, key) => String(kw[key] ?? `{${key}}`));
  } catch {
    // ignore
  }
  const buttonsText = settings.welcome_buttons as string | undefined;
  let sent;
  if (buttonsText) {
    const [, buttons] = parseButtonMarkdown(buttonsText);
    sent = await ctx.api.sendMessage(chatId, msg, { reply_markup: buildKeyboard(buttons) });
  } else {
    sent = await ctx.api.sendMessage(chatId, msg);
  }
  if (settings.clean_welcome) {
    await saveGroupSetting(chatId, { last_welcome_message_id: sent.message_id });
  }
}

async function sendGoodbye(ctx: Context, chatId: number, chatName: string, user: { id: number; first_name?: string; last_name?: string }, serviceMessageId?: number): Promise<void> {
  const settings = await getGroupSettings(chatId);
  if (settings.clean_service && serviceMessageId) {
    try {
      await ctx.api.deleteMessage(chatId, serviceMessageId);
    } catch {
      // ignore missing delete permissions
    }
  }
  if (!settings.goodbye_enabled) return;

  const memberCount = await ctx.api.getChatMemberCount(chatId);
  const kw: Record<string, string | number> = {
    first: user.first_name || "",
    fullname: `${user.first_name || ""} ${user.last_name || ""}`.trim(),
    count: memberCount,
    chatname: chatName || "this camp",
  };
  let msg = (settings.goodbye_message as string) ||
    pick(GOODBYE_TEXTS, { first: kw.first as string, count: kw.count as number });
  try {
    msg = msg.replace(/\{(\w+)\}/g, (_, key) => String(kw[key] ?? `{${key}}`));
  } catch {
    // ignore
  }
  const [clean] = parseButtonMarkdown(msg);
  await ctx.api.sendMessage(chatId, clean);
}

composer.on("chat_member", async (ctx: Context) => {
  const event = ctx.chatMember;
  if (!event) return;
  const chatId = event.chat.id;
  const newStatus = event.new_chat_member.status;
  const oldStatus = event.old_chat_member.status;
  const user = event.new_chat_member.user;

  if (
    newStatus === "administrator" ||
    oldStatus === "administrator" ||
    newStatus === "creator" ||
    oldStatus === "creator"
  ) {
    await fetchAndCacheAdmins(chatId, ctx.api);
  }

  if (
    newStatus === "member" &&
    (oldStatus === "left" || oldStatus === "kicked")
  ) {
    await sendWelcome(ctx, chatId, event.chat.title || "this camp", user);
  } else if (
    (newStatus === "left" || newStatus === "kicked") &&
    oldStatus === "member"
  ) {
    await sendGoodbye(ctx, chatId, event.chat.title || "this camp", user);
  }
});

composer.on("message:new_chat_members", async (ctx: Context) => {
  const msg = ctx.message as Message;
  if (!msg?.new_chat_members) return;
  for (const user of msg.new_chat_members) {
    await sendWelcome(ctx, msg.chat.id, msg.chat.title || "this camp", user, msg.message_id);
  }
});

composer.on("message:left_chat_member", async (ctx: Context) => {
  const msg = ctx.message as Message;
  if (!msg?.left_chat_member) return;
  await sendGoodbye(ctx, msg.chat.id, msg.chat.title || "this camp", msg.left_chat_member, msg.message_id);
});

composer.command(
  ["welcome", "setwelcome", "resetwelcome", "goodbye", "setgoodbye", "resetgoodbye", "welcomemute", "cleanwelcome", "cleanservice"],
  async (ctx: Context) => {
    const msg = ctx.message as Message;
    if (!msg || !(await requireGroup(ctx))) return;
    const text = msg.text || "";
    const cmd = commandName(text);

    if (cmd === "/welcome") {
      const settings = await getGroupSettings(msg.chat.id);
      if (text.split(/\s+/).length > 1) {
        const val = !settings.welcome_enabled;
        await saveGroupSetting(msg.chat.id, { welcome_enabled: val });
        await ctx.reply(`Welcome messages: <b>${val ? "enabled" : "disabled"}</b>`);
      } else {
        await ctx.reply(
          `Welcome: <b>${settings.welcome_enabled ? "on" : "off"}</b>\nCustom: <b>${settings.welcome_message ? "set" : "default"}</b>`,
        );
      }
    } else if (cmd === "/setwelcome") {
      let welcomeText: string;
      if (msg.reply_to_message) {
        welcomeText = msg.reply_to_message.text || msg.reply_to_message.caption || "Welcome!";
      } else {
        const parts = text.split(/\s+/);
        if (parts.length < 2) {
          await ctx.reply("Provide a welcome message or reply to one for me to carve.");
          return;
        }
        welcomeText = parts.slice(1).join(" ");
      }
      await saveGroupSetting(msg.chat.id, { welcome_message: welcomeText });
      await ctx.reply("The welcome message is set. New arrivals shall hear it.");
    } else if (cmd === "/resetwelcome") {
      await saveGroupSetting(msg.chat.id, { welcome_message: null });
      await ctx.reply("Welcome reset to the old ways.");
    } else if (cmd === "/goodbye") {
      const settings = await getGroupSettings(msg.chat.id);
      if (text.split(/\s+/).length > 1) {
        const val = !settings.goodbye_enabled;
        await saveGroupSetting(msg.chat.id, { goodbye_enabled: val });
        await ctx.reply(`Goodbye messages: <b>${val ? "enabled" : "disabled"}</b>`);
      } else {
        await ctx.reply(
          `Goodbye: <b>${settings.goodbye_enabled ? "on" : "off"}</b>\nCustom: <b>${settings.goodbye_message ? "set" : "default"}</b>`,
        );
      }
    } else if (cmd === "/setgoodbye") {
      let goodbyeText: string;
      if (msg.reply_to_message) {
        goodbyeText = msg.reply_to_message.text || msg.reply_to_message.caption || "Goodbye!";
      } else {
        const parts = text.split(/\s+/);
        if (parts.length < 2) {
          await ctx.reply("Provide a goodbye message or reply to one.");
          return;
        }
        goodbyeText = parts.slice(1).join(" ");
      }
      await saveGroupSetting(msg.chat.id, { goodbye_message: goodbyeText });
      await ctx.reply("The farewell is inscribed. Departing souls shall hear it.");
    } else if (cmd === "/resetgoodbye") {
      await saveGroupSetting(msg.chat.id, { goodbye_message: null });
      await ctx.reply("Goodbye reset to the old ways.");
    } else if (cmd === "/welcomemute") {
      const parts = text.split(/\s+/);
      if (
        parts.length > 1 &&
        ["off", "soft", "strong", "captcha"].includes(parts[1].toLowerCase())
      ) {
        await saveGroupSetting(msg.chat.id, {
          welcome_mute: parts[1].toLowerCase(),
        });
        await ctx.reply(`Welcome mute set to: <b>${parts[1].toLowerCase()}</b>`);
      } else {
        const settings = await getGroupSettings(msg.chat.id);
        await ctx.reply(
          `Current welcome mute: <b>${settings.welcome_mute}</b>\nOptions: off, soft, strong, captcha`,
        );
      }
    } else if (cmd === "/cleanwelcome") {
      const settings = await getGroupSettings(msg.chat.id);
      const val = !settings.clean_welcome;
      await saveGroupSetting(msg.chat.id, { clean_welcome: val });
      await ctx.reply(`Clean welcome: <b>${val ? "on" : "off"}</b>`);
    } else if (cmd === "/cleanservice") {
      const settings = await getGroupSettings(msg.chat.id);
      const val = !settings.clean_service;
      await saveGroupSetting(msg.chat.id, { clean_service: val });
      await ctx.reply(`Clean service: <b>${val ? "on" : "off"}</b>`);
    }
  },
);

// ── Rules ──

composer.command("rules", async (ctx: Context) => {
  const msg = ctx.message as Message;
  if (!msg || !(await requireGroup(ctx))) return;
  const settings = await getGroupSettings(msg.chat.id);
  const rules = settings.rules as string | undefined;
  if (rules) {
    await ctx.reply(`${pick(RULES_TEXTS)}\n\n${escapeHtml(rules)}`);
  } else {
    await ctx.reply(pick(NO_RULES_TEXTS));
  }
});

composer.command("setrules", async (ctx: Context) => {
  const msg = ctx.message as Message;
  if (!msg || !(await requireGroup(ctx))) return;
  const parts = msg.text?.split(/\s+/) || [];
  if (parts.length < 2) {
    await ctx.reply("What laws shall I inscribe? Provide text after <code>/setrules</code>");
    return;
  }
  await saveGroupSetting(msg.chat.id, { rules: parts.slice(1).join(" ") });
  await ctx.reply("The laws are written. Break them at your peril.");
});

composer.command("clearrules", async (ctx: Context) => {
  const msg = ctx.message as Message;
  if (!msg || !(await requireGroup(ctx))) return;
  await saveGroupSetting(msg.chat.id, { rules: null });
  await ctx.reply("The laws have been erased. Chaos returns.");
});

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

// ── Sticker Blacklist ──

composer.command("addblsticker", async (ctx: Context) => {
  const msg = ctx.message as Message;
  if (!msg?.reply_to_message?.sticker) {
    await ctx.reply("Reply to a sticker to blacklist it.");
    return;
  }
  const trigger = msg.reply_to_message.sticker.file_id;
  await addStickerBlacklist(msg.chat.id, trigger);
  cacheDelete(`sticker_bl:${msg.chat.id}`);
  await ctx.reply("That trophy is banned from this camp.");
});

composer.command("unblsticker", async (ctx: Context) => {
  const msg = ctx.message as Message;
  if (!msg?.reply_to_message?.sticker) {
    await ctx.reply("Reply to a sticker to unban it.");
    return;
  }
  const trigger = msg.reply_to_message.sticker.file_id;
  await removeStickerBlacklist(msg.chat.id, trigger);
  cacheDelete(`sticker_bl:${msg.chat.id}`);
  await ctx.reply("That trophy is no longer banned.");
});

composer.command("blsticker", async (ctx: Context) => {
  const msg = ctx.message as Message;
  if (!msg) return;
  const stickers = await getStickerBlacklist(msg.chat.id);
  if (stickers.length > 0) {
    await ctx.reply(`<b>${stickers.length} banned trophies.</b>`);
  } else {
    await ctx.reply("No banned stickers in this camp.");
  }
});

composer.command("blstickermode", async (ctx: Context) => {
  const msg = ctx.message as Message;
  if (!msg) return;
  const parts = msg.text?.split(/\s+/) || [];
  const modes = ["nothing", "delete", "warn", "mute", "kick", "ban", "tban", "tmute"];
  if (parts.length < 2 || !modes.includes(parts[1].toLowerCase())) {
    await ctx.reply(`Usage: <code>/blstickermode &lt;${modes.join("/")}&gt;</code>`);
    return;
  }
  await saveGroupSetting(msg.chat.id, {
    sticker_blacklist_action: parts[1].toLowerCase(),
  });
  await ctx.reply(`Sticker blacklist action: <b>${parts[1].toLowerCase()}</b>`);
});

// ── Anti-Linked Channel ──

composer.command("antilinked", async (ctx: Context) => {
  const msg = ctx.message as Message;
  if (!msg) return;
  const val = await toggleAntiLinked(msg.chat.id);
  await ctx.reply(`Anti-linked channel: <b>${val ? "enabled" : "disabled"}</b>`);
});

composer.command("antipin", async (ctx: Context) => {
  const msg = ctx.message as Message;
  if (!msg) return;
  const val = await toggleAntiPin(msg.chat.id);
  await ctx.reply(`Anti-pin: <b>${val ? "enabled" : "disabled"}</b>`);
});

// ── AntiChannel ──

composer.command("antichannel", async (ctx: Context) => {
  const msg = ctx.message as Message;
  if (!msg) return;
  const val = await toggleAntiChannel(msg.chat.id);
  await ctx.reply(`Anti-channel: <b>${val ? "enabled" : "disabled"}</b>`);
});

// ── Warn Filters ──

composer.command("addwarn", async (ctx: Context) => {
  const msg = ctx.message as Message;
  if (!msg) return;
  const text = msg.text || msg.caption || "";
  const parts = text.split(/\s+/);
  if (parts.length < 2) {
    await ctx.reply("Usage: <code>/addwarn &lt;keyword&gt;</code>");
    return;
  }
  const keyword = parts.slice(1).join(" ").trim().toLowerCase();
  await addWarnFilter(msg.chat.id, keyword);
  await ctx.reply(`Auto-warn set for <b>'${keyword}'</b>.`);
});

composer.command("nowarn", async (ctx: Context) => {
  const msg = ctx.message as Message;
  if (!msg) return;
  const parts = msg.text?.split(/\s+/) || [];
  if (parts.length < 2) {
    await ctx.reply("Which auto-warn keyword should I stop watching for?");
    return;
  }
  const keyword = parts.slice(1).join(" ").trim().toLowerCase();
  await removeWarnFilter(msg.chat.id, keyword);
  await ctx.reply(`Auto-warn removed for <b>'${keyword}'</b>.`);
});

composer.command(["warnlist", "warnfilters"], async (ctx: Context) => {
  const msg = ctx.message as Message;
  if (!msg) return;
  const wfs = await getWarnFilters(msg.chat.id);
  if (wfs.length > 0) {
    const lines = [`<b>${wfs.length} auto-warn keywords:</b>`];
    for (const w of wfs) {
      lines.push(`• <code>${w.keyword}</code>`);
    }
    await ctx.reply(lines.join("\n"));
  } else {
    await ctx.reply("No auto-warn keywords are set.");
  }
});

composer.command("warnlimit", async (ctx: Context) => {
  const msg = ctx.message as Message;
  if (!msg) return;
  const parts = msg.text?.split(/\s+/) || [];
  if (parts.length < 2 || !/^\d+$/.test(parts[1])) {
    await ctx.reply("Usage: <code>/warnlimit &lt;number&gt;</code> (minimum 3)");
    return;
  }
  const limit = Math.max(3, parseInt(parts[1], 10));
  await saveGroupSetting(msg.chat.id, { warn_limit: limit });
  await ctx.reply(`Warn limit set to <b>${limit}</b>.`);
});

// ── Log Channel ──

composer.command("logchannel", async (ctx: Context) => {
  const msg = ctx.message as Message;
  if (!msg) return;
  const parts = msg.text?.split(/\s+/) || [];
  if (parts.length < 2 || !/^-?\d+$/.test(parts[1])) {
    await ctx.reply("Usage: <code>/logchannel &lt;chat_id&gt;</code>");
    return;
  }
  const chatId = parseInt(parts[1], 10);
  await saveGroupSetting(msg.chat.id, { log_channel: chatId });
  await ctx.reply(`Log channel set to <code>${chatId}</code>.`);
});

composer.command("unlinklog", async (ctx: Context) => {
  const msg = ctx.message as Message;
  if (!msg) return;
  await saveGroupSetting(msg.chat.id, { log_channel: null });
  await ctx.reply("Log channel unlinked. The hunt leaves no record here.");
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
      const [clean] = parseButtonMarkdown(content);
      await ctx.reply(escapeHtml(clean));
      return;
    }
  }
  await next();
});
