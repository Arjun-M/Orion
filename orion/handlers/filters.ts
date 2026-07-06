import { Composer } from "grammy";
import type { Context } from "grammy";
import type { Message } from "grammy/types";
import {
  LOCK_TEXTS,
  UNLOCK_TEXTS,
  FLOOD_SET_TEXTS,
  FLOOD_ACTION_TEXTS,
  FILTER_CREATED_TEXTS,
  FILTER_REMOVED_TEXTS,
  BLACKLIST_ADD_TEXTS,
  BLACKLIST_REMOVE_TEXTS,
  pick,
} from "../utils/texts.js";
import { requireGroup, escapeHtml } from "../utils/helpers.js";
import {
  getGroupSettings,
  saveGroupSetting,
  getFilter,
  saveFilter,
  listFilters,
  deleteFilter,
  getBlacklistWords,
  addBlacklistWord,
  removeBlacklistWord,
  getLocks,
  setLock,
  LOCKABLE_FIELDS,
} from "../database/models.js";
import { cacheDelete } from "../database/cache.js";

export const composer = new Composer<Context>();

export const modName = "Filters";

export const helpText =
  "I watch for keywords, ban words, cage content types, and calm floods. Set traps and let me do the rest.\n\n" +
  "<b>Traps (Keyword Filters):</b>\n" +
  "• <code>/filter &lt;word&gt; &lt;reply&gt;</code> — Set a keyword trap\n" +
  "• <code>/stop &lt;word&gt;</code> — Remove a trap\n" +
  "• <code>/filters</code> — List all traps\n\n" +
  "<b>Banned Quarry (Blacklist):</b>\n" +
  "• <code>/addblacklist &lt;word&gt;</code> — Hunt a new word\n" +
  "• <code>/unblacklist &lt;word&gt;</code> — Stop hunting it\n" +
  "• <code>/blacklist</code> — List all hunted words\n" +
  "• <code>/blacklistmode &lt;action&gt;</code> — Set punishment mode\n\n" +
  "<b>Cages (Locks):</b>\n" +
  "• <code>/lock &lt;type&gt;</code> — Cage a content type (photo, url, sticker, etc.)\n" +
  "• <code>/unlock &lt;type&gt;</code> — Free it\n" +
  "• <code>/locks</code> — View active cages\n" +
  "• <code>/locktypes</code> — List all lockable types\n\n" +
  "<b>Storm (Anti-Flood):</b>\n" +
  "• <code>/setflood &lt;count&gt;</code> — Set the message threshold\n" +
  "• <code>/setfloodmode &lt;action&gt;</code> — Set punishment for flooders";

// ── Filters ──

composer.command("filter", async (ctx: Context) => {
  const msg = ctx.message as Message;
    if (!msg || !(await requireGroup(ctx))) return;
  const text = msg.text || msg.caption || "";
  const parts = text.split(/\s+/);
  if (parts.length < 2) {
    await ctx.reply("Usage: <code>/filter &lt;keyword&gt; &lt;reply&gt;</code>");
    return;
  }

  const sub = parts.slice(1).join(" ");
  const spaceIdx = sub.indexOf(" ");
  const keyword = (spaceIdx > 0 ? sub.slice(0, spaceIdx) : sub).toLowerCase();
  let reply = spaceIdx > 0 ? sub.slice(spaceIdx + 1) : "";

  if (!reply) {
    if (msg.reply_to_message) {
      reply = msg.reply_to_message.text || msg.reply_to_message.caption || "";
    } else {
      await ctx.reply("Provide a reply for the keyword to trigger.");
      return;
    }
  }

  await saveFilter(msg.chat.id, keyword, reply);
  cacheDelete(`filters:${msg.chat.id}`);
  await ctx.reply(pick(FILTER_CREATED_TEXTS, { keyword: escapeHtml(keyword) }));
});

composer.command("stop", async (ctx: Context) => {
  const msg = ctx.message as Message;
    if (!msg || !(await requireGroup(ctx))) return;
  const parts = msg.text?.split(/\s+/) || [];
  if (parts.length < 2) {
    await ctx.reply("Which trap shall I dismantle? <code>/stop &lt;keyword&gt;</code>");
    return;
  }

  const keyword = parts.slice(1).join(" ").trim().toLowerCase();
  const cf = await getFilter(msg.chat.id, keyword);
  if (cf) {
    await deleteFilter(msg.chat.id, keyword);
    cacheDelete(`filters:${msg.chat.id}`);
    await ctx.reply(pick(FILTER_REMOVED_TEXTS, { keyword: escapeHtml(keyword) }));
  } else {
    await ctx.reply(`No trap is set for <b>'${escapeHtml(keyword)}'</b>.`);
  }
});

composer.command("filters", async (ctx: Context) => {
  const msg = ctx.message as Message;
    if (!msg || !(await requireGroup(ctx))) return;
  const filters = await listFilters(msg.chat.id);
  if (filters.length > 0) {
    const lines = [`<b>${filters.length} traps set:</b>`];
    for (const f of filters) {
      lines.push(`• <code>${f.keyword}</code>`);
    }
    await ctx.reply(lines.join("\n"));
  } else {
    await ctx.reply("No traps are set in this camp.");
  }
});

// ── Blacklist ──

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

// ── Locks ──

composer.command("lock", async (ctx: Context) => {
  const msg = ctx.message as Message;
    if (!msg || !(await requireGroup(ctx))) return;
  const parts = msg.text?.split(/\s+/) || [];
  if (parts.length < 2 || !LOCKABLE_FIELDS.includes(parts[1].toLowerCase())) {
    await ctx.reply(`Cage what? Options: <code>${LOCKABLE_FIELDS.join(", ")}</code>`);
    return;
  }
  const item = parts[1].toLowerCase();
  await setLock(msg.chat.id, item, true);
  await ctx.reply(pick(LOCK_TEXTS, { item }));
});

composer.command("unlock", async (ctx: Context) => {
  const msg = ctx.message as Message;
    if (!msg || !(await requireGroup(ctx))) return;
  const parts = msg.text?.split(/\s+/) || [];
  if (parts.length < 2 || !LOCKABLE_FIELDS.includes(parts[1].toLowerCase())) {
    await ctx.reply(`Free what? Options: <code>${LOCKABLE_FIELDS.join(", ")}</code>`);
    return;
  }
  const item = parts[1].toLowerCase();
  await setLock(msg.chat.id, item, false);
  await ctx.reply(pick(UNLOCK_TEXTS, { item }));
});

composer.command("locks", async (ctx: Context) => {
  const msg = ctx.message as Message;
    if (!msg || !(await requireGroup(ctx))) return;
  const locks = await getLocks(msg.chat.id);
  const active = LOCKABLE_FIELDS.filter((k) => locks[k]);
  if (active.length > 0) {
    await ctx.reply(`<b>Caged items:</b> <code>${active.join(", ")}</code>`);
  } else {
    await ctx.reply("Nothing is caged.");
  }
});

composer.command("locktypes", async (ctx: Context) => {
  const msg = ctx.message as Message;
    if (!msg || !(await requireGroup(ctx))) return;
  await ctx.reply(`Lockable types:\n<code>${LOCKABLE_FIELDS.join(", ")}</code>`);
});

// ── Anti-Flood ──

composer.command("setflood", async (ctx: Context) => {
  const msg = ctx.message as Message;
    if (!msg || !(await requireGroup(ctx))) return;
  const parts = msg.text?.split(/\s+/) || [];
  if (parts.length < 2 || !/^\d+$/.test(parts[1])) {
    await ctx.reply("Usage: <code>/setflood &lt;count&gt;</code>");
    return;
  }
  const count = parseInt(parts[1], 10);
  await saveGroupSetting(msg.chat.id, { flood_limit: count });
  await ctx.reply(pick(FLOOD_SET_TEXTS, { count }));
});

composer.command("setfloodmode", async (ctx: Context) => {
  const msg = ctx.message as Message;
    if (!msg || !(await requireGroup(ctx))) return;
  const parts = msg.text?.split(/\s+/) || [];
  const modes = ["ban", "kick", "mute", "tban", "tmute"];
  if (
    parts.length < 2 ||
    !modes.includes(parts[1].toLowerCase())
  ) {
    await ctx.reply("Usage: <code>/setfloodmode &lt;ban/kick/mute/tban/tmute&gt;</code>");
    return;
  }
  const action = parts[1].toLowerCase();
  await saveGroupSetting(msg.chat.id, { flood_action: action });
  await ctx.reply(
    pick(FLOOD_ACTION_TEXTS, { action, action_past: action + "ed" }),
  );
});

// ── Blacklist mode ──

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
