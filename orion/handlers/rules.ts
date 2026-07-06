import { Composer } from "grammy";
import type { Context } from "grammy";
import type { Message } from "grammy/types";
import {
  RULES_TEXTS,
  NO_RULES_TEXTS,
  pick,
} from "../utils/texts.js";
import { requireGroup, escapeHtml } from "../utils/helpers.js";
import {
  getGroupSettings,
  saveGroupSetting,
} from "../database/models.js";

export const composer = new Composer<Context>();

export const modName = "Rules";

export const helpText =
  "The laws of the camp, inscribed in starlight. Set rules for your members to see, " +
  "and update them whenever the pack's code changes.\n\n" +
  "<b>Commands:</b>\n" +
  "• <code>/rules</code> — Read the camp's laws\n" +
  "• <code>/setrules &lt;text&gt;</code> — Write the laws\n" +
  "• <code>/clearrules</code> — Erase them\n\n" +
  "<b>How it works:</b> Rules are stored per-group and support HTML formatting. " +
  "Use <code>/setrules</code> to inscribe your camp code. Anyone can read with <code>/rules</code>.";

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
