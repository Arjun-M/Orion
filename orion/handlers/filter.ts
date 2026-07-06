import { Composer } from "grammy";
import type { Context } from "grammy";
import type { Message } from "grammy/types";
import {
  FILTER_CREATED_TEXTS,
  FILTER_REMOVED_TEXTS,
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
  getWarnFilters,
  addWarnFilter,
  removeWarnFilter,
} from "../database/models.js";
import { cacheDelete } from "../database/cache.js";

export const composer = new Composer<Context>();

export const modName = "Filters";

export const helpText =
  "I watch for keywords and auto-warn on triggers. When someone speaks a watched keyword, " +
  "I reply with your preset message. Auto-warns stack arrows — hit the limit and the user is banned.\n\n" +
  "<b>Traps (Keyword Filters):</b>\n" +
  "• <code>/filter &lt;word&gt; &lt;reply&gt;</code> — Set a keyword trap\n" +
  "• <code>/stop &lt;word&gt;</code> — Remove a trap\n" +
  "• <code>/filters</code> — List all traps\n\n" +
  "<b>Arrow Filters (Auto-Warn):</b>\n" +
  "• <code>/addwarn &lt;keyword&gt;</code> — Auto-warn on keyword\n" +
  "• <code>/nowarn &lt;keyword&gt;</code> — Remove auto-warn\n" +
  "• <code>/warnlist</code> — List auto-warn keywords\n" +
  "• <code>/warnlimit &lt;n&gt;</code> — Set arrow limit (min 3)\n\n" +
  "<b>How it works:</b> Every message is checked against your traps and auto-warn keywords. " +
  "If a trap matches, I reply with your preset. If an auto-warn matches, the user gets a warning arrow. " +
  "When arrows reach the limit, the user is banned. Use /markdownhelp for formatting and variables.";

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
