import { Composer } from "grammy";
import type { Context } from "grammy";
import type { Message } from "grammy/types";
import { SLAP_TEXTS, pick } from "../utils/texts.js";
import { escapeHtml } from "../utils/helpers.js";

export const composer = new Composer<Context>();

export const modName = "Fun";

export const helpText =
  "Even a demigod needs sport between hunts.\n\n" +
  "<b>Commands:</b>\n" +
  "• <code>/slap &lt;user&gt;</code> — Slap a fool with giant's strength\n" +
  "• <code>/roll [max]</code> — Roll the dice of fate (default 1-100)\n" +
  "• <code>/toss</code> — Flip a coin. Heads or tails?\n" +
  "• <code>/shout &lt;text&gt;</code> — Make yourself heard across the cosmos\n" +
  "• <code>/shrug</code> — Shrug it off like a demigod\n" +
  "• <code>/decide &lt;opt1&gt; or &lt;opt2&gt;</code> — Let fate choose\n" +
  "• <code>/runs</code> — Flee from the conversation";

composer.command("slap", async (ctx: Context) => {
  const msg = ctx.message as Message;
  if (!msg) return;
  const target = msg.reply_to_message?.from;
  if (!target) {
    await ctx.reply("Reply to someone you want me to slap.");
    return;
  }
  await ctx.reply(
    pick(SLAP_TEXTS, {
      user1: escapeHtml(msg.from!.first_name),
      user2: escapeHtml(target.first_name),
    }),
  );
});

composer.command("roll", async (ctx: Context) => {
  const msg = ctx.message as Message;
  if (!msg) return;
  const parts = msg.text?.split(/\s+/) || [];
  if (parts.length >= 2) {
    const maxVal = parseInt(parts[1], 10);
    if (!isNaN(maxVal)) {
      const result = Math.floor(Math.random() * maxVal) + 1;
      await ctx.reply(
        `<b>${escapeHtml(msg.from!.first_name)}</b> rolled <b>${result}</b> (1-${escapeHtml(String(maxVal))}).`,
      );
      return;
    }
  }
  const result = Math.floor(Math.random() * 100) + 1;
  await ctx.reply(
    `<b>${escapeHtml(msg.from!.first_name)}</b> rolled <b>${result}</b> (1-100).`,
  );
});

composer.command("toss", async (ctx: Context) => {
  const msg = ctx.message as Message;
  if (!msg) return;
  const result = Math.random() < 0.5 ? "Heads" : "Tails";
  await ctx.reply(
    `<b>${escapeHtml(msg.from!.first_name)}</b> tossed a coin: <b>${result}</b>.`,
  );
});

composer.command("shout", async (ctx: Context) => {
  const msg = ctx.message as Message;
  if (!msg) return;
  const parts = msg.text?.split(/\s+/) || [];
  if (parts.length < 2) {
    await ctx.reply("What should I shout?");
    return;
  }
  const text = parts.slice(1).join(" ").toUpperCase();
  const spaced = text.split("").join(" ");
  await ctx.reply(escapeHtml(spaced));
});

composer.command("shrug", async (ctx: Context) => {
  const msg = ctx.message as Message;
  if (!msg) return;
  await ctx.reply("¯\\_(ツ)_/¯");
});

composer.command("decide", async (ctx: Context) => {
  const msg = ctx.message as Message;
  if (!msg) return;
  const parts = msg.text?.split(/\s+/) || [];
  if (parts.length < 2) {
    await ctx.reply("I should decide what? Provide options separated by 'or'.");
    return;
  }
  const options = parts
    .slice(1)
    .join(" ")
    .split(" or ")
    .map((o) => o.trim())
    .filter((o) => o);
  if (options.length < 2) {
    await ctx.reply("Give me at least two options separated by 'or'.");
    return;
  }
  const choice = options[Math.floor(Math.random() * options.length)];
  await ctx.reply(`Fate chooses: <b>${escapeHtml(choice)}</b>`);
});

composer.command("runs", async (ctx: Context) => {
  const msg = ctx.message as Message;
  if (!msg) return;
  await ctx.reply(
    `<b>${escapeHtml(msg.from!.first_name)}</b> runs away! 🏃`,
  );
});
