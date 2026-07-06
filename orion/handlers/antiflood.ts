import { Composer } from "grammy";
import type { Context } from "grammy";
import type { Message } from "grammy/types";
import {
  LOCK_TEXTS,
  UNLOCK_TEXTS,
  FLOOD_SET_TEXTS,
  FLOOD_ACTION_TEXTS,
  pick,
} from "../utils/texts.js";
import { requireGroup } from "../utils/helpers.js";
import {
  getGroupSettings,
  saveGroupSetting,
  getLocks,
  setLock,
  LOCKABLE_FIELDS,
} from "../database/models.js";

export const composer = new Composer<Context>();

export const modName = "Anti-Flood";

export const helpText =
  "I cage content types, calm floods, and silence unwanted channels. " +
  "Every message is checked against active locks — blocked content is silently deleted. " +
  "Flood detection uses a 10-second window: if a user sends more messages than your threshold, " +
  "the configured action triggers automatically.\n\n" +
  "<b>Cages (Locks):</b>\n" +
  "• <code>/lock &lt;type&gt;</code> — Cage a content type (photo, url, sticker, etc.)\n" +
  "• <code>/unlock &lt;type&gt;</code> — Free it\n" +
  "• <code>/locks</code> — View active cages\n" +
  "• <code>/locktypes</code> — List all lockable types\n\n" +
  "<b>Storm (Anti-Flood):</b>\n" +
  "• <code>/setflood &lt;count&gt;</code> — Set the message threshold (within 10s)\n" +
  "• <code>/setfloodmode &lt;action&gt;</code> — Set punishment for flooders\n\n" +
  "<b>Other:</b>\n" +
  "• <code>/antichannel</code> — Toggle auto-deletion of channel messages\n" +
  "• <code>/antilinked</code> — Toggle auto-deletion of linked channel forwards\n" +
  "• <code>/antipin</code> — Toggle auto-deletion of channel pins\n\n" +
  "<b>How it works:</b> Locks silently delete matching content. " +
  "Flood tracks message counts per user in a 10-second sliding window. " +
  "Anti-channel/anti-linked instantly delete messages from channels and linked chat forwards. " +
  "Action modes: <code>ban</code>, <code>kick</code>, <code>mute</code>, <code>tban</code>, <code>tmute</code>.";

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

composer.command("antichannel", async (ctx: Context) => {
  const msg = ctx.message as Message;
  if (!msg) return;
  const { toggleAntiChannel } = await import("../database/models.js");
  const val = await toggleAntiChannel(msg.chat.id);
  await ctx.reply(`Anti-channel: <b>${val ? "enabled" : "disabled"}</b>`);
});

composer.command("antilinked", async (ctx: Context) => {
  const msg = ctx.message as Message;
  if (!msg) return;
  const { toggleAntiLinked } = await import("../database/models.js");
  const val = await toggleAntiLinked(msg.chat.id);
  await ctx.reply(`Anti-linked channel: <b>${val ? "enabled" : "disabled"}</b>`);
});

composer.command("antipin", async (ctx: Context) => {
  const msg = ctx.message as Message;
  if (!msg) return;
  const { toggleAntiPin } = await import("../database/models.js");
  const val = await toggleAntiPin(msg.chat.id);
  await ctx.reply(`Anti-pin: <b>${val ? "enabled" : "disabled"}</b>`);
});
