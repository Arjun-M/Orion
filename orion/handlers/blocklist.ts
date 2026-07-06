import { Composer } from "grammy";
import type { Context } from "grammy";
import type { Message } from "grammy/types";
import {
  BLACKLIST_ADD_TEXTS,
  BLACKLIST_REMOVE_TEXTS,
  pick,
} from "../utils/texts.js";
import { requireGroup, escapeHtml } from "../utils/helpers.js";
import {
  getGroupSettings,
  saveGroupSetting,
  getBlacklistWords,
  addBlacklistWord,
  removeBlacklistWord,
  getStickerBlacklist,
  addStickerBlacklist,
  removeStickerBlacklist,
} from "../database/models.js";
import { cacheDelete } from "../database/cache.js";

export const composer = new Composer<Context>();

export const modName = "Blocklist";

export const helpText =
  "I hunt banned words and stickers. When a message contains a blacklisted word or sticker, " +
  "I take action — from silently deleting to banning the offender.\n\n" +
  "<b>Banned Quarry (Word Blacklist):</b>\n" +
  "• <code>/addblacklist &lt;word&gt;</code> — Hunt a new word\n" +
  "• <code>/unblacklist &lt;word&gt;</code> — Stop hunting it\n" +
  "• <code>/blacklist</code> — List all hunted words\n" +
  "• <code>/blacklistmode &lt;action&gt;</code> — Set punishment mode\n\n" +
  "<b>Banned Trophies (Sticker Blacklist):</b>\n" +
  "• <code>/addblsticker</code> — Ban a replied sticker\n" +
  "• <code>/unblsticker</code> — Unban a replied sticker\n" +
  "• <code>/blsticker</code> — List banned stickers\n" +
  "• <code>/blstickermode &lt;action&gt;</code> — Set sticker punishment\n\n" +
  "<b>How it works:</b> Every message is scanned for blacklisted words and stickers. " +
  "Action modes: <code>nothing</code> (log only), <code>delete</code>, <code>warn</code>, <code>mute</code>, <code>kick</code>, <code>ban</code>, " +
  "<code>tban</code> (temp ban 1h), <code>tmute</code> (temp mute 1h). " +
  "Warn mode stacks until the user hits the warn limit in Filters.";

composer.command("addblacklist", async (ctx: Context) => {
  const msg = ctx.message as Message;
    if (!msg || !(await requireGroup(ctx))) return;
  const parts = msg.text?.split(/\s+/) || [];
  if (parts.length < 2) {
    await ctx.reply("Which word should I hunt? <code>/addblacklist &lt;word&gt;</code>");
    return;
  }
  const word = parts.slice(1).join(" ").trim().toLowerCase();
  await addBlacklistWord(msg.chat.id, word);
  cacheDelete(`blacklist:${msg.chat.id}`);
  await ctx.reply(pick(BLACKLIST_ADD_TEXTS, { word: escapeHtml(word) }));
});

composer.command("unblacklist", async (ctx: Context) => {
  const msg = ctx.message as Message;
    if (!msg || !(await requireGroup(ctx))) return;
  const parts = msg.text?.split(/\s+/) || [];
  if (parts.length < 2) {
    await ctx.reply("Which word should I stop hunting? <code>/unblacklist &lt;word&gt;</code>");
    return;
  }
  const word = parts.slice(1).join(" ").trim().toLowerCase();
  await removeBlacklistWord(msg.chat.id, word);
  cacheDelete(`blacklist:${msg.chat.id}`);
  await ctx.reply(pick(BLACKLIST_REMOVE_TEXTS, { word: escapeHtml(word) }));
});

composer.command("blacklist", async (ctx: Context) => {
  const msg = ctx.message as Message;
    if (!msg || !(await requireGroup(ctx))) return;
  const words = await getBlacklistWords(msg.chat.id);
  if (words.length > 0) {
    const lines = [`<b>${words.length} banned words:</b>`];
    for (const w of words) {
      lines.push(`• <code>${w.word}</code>`);
    }
    await ctx.reply(lines.join("\n"));
  } else {
    await ctx.reply("No banned words in this camp.");
  }
});

composer.command("blacklistmode", async (ctx: Context) => {
  const msg = ctx.message as Message;
    if (!msg || !(await requireGroup(ctx))) return;
  const parts = msg.text?.split(/\s+/) || [];
  const modes = ["nothing", "delete", "warn", "mute", "kick", "ban", "tban", "tmute"];
  if (parts.length < 2 || !modes.includes(parts[1].toLowerCase())) {
    await ctx.reply(`Usage: <code>/blacklistmode &lt;${modes.join("/")}&gt;</code>`);
    return;
  }
  await saveGroupSetting(msg.chat.id, {
    blacklist_action: parts[1].toLowerCase(),
  });
  await ctx.reply(`Blacklist action: <b>${parts[1].toLowerCase()}</b>`);
});

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
