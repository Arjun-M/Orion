import { Composer } from "grammy";
import type { Context } from "grammy";
import type { Message } from "grammy/types";
import { pick, PASTE_TEXTS } from "../utils/texts.js";
import { splitMessage, escapeHtml } from "../utils/helpers.js";

export const composer = new Composer<Context>();

export const modName = "Misc";

export const helpText =
  "A hunter's tools extend beyond the spear.\n\n" +
  "<b>Commands:</b>\n" +
  "• <code>/id [user]</code> — Learn a hunter's mark\n" +
  "• <code>/info [user]</code> — Know thy packmate\n" +
  "• <code>/stickerid</code> — Identify a sticker's essence\n" +
  "• <code>/getsticker</code> — Capture a sticker as an image\n" +
  "• <code>/paste &lt;text&gt;</code> — Store words in the ether\n" +
  "• <code>/tr &lt;lang&gt; &lt;text&gt;</code> — Translate tongues\n" +
  "• <code>/ud &lt;word&gt;</code> — Consult the Urban Dictionary\n" +
  "• <code>/ping</code> — Check if I am awake\n" +
  "• <code>/pong</code> — Reverse the pulse check\n" +
  "• <code>/modules</code> — List all my arts";

composer.command("id", async (ctx: Context) => {
  const msg = ctx.message as Message;
  if (!msg) return;
  const target = msg.reply_to_message?.from || msg.from!;
  let txt =
    `<b>${target.first_name}</b>\n` +
    `ID: <code>${target.id}</code>\n` +
    `Chat: <code>${msg.chat.id}</code>`;
  if ("username" in msg.chat && msg.chat.username) {
    txt += `\nChat @: @${msg.chat.username}`;
  }
  if (target.username) {
    txt += `\nUser @: @${target.username}`;
  }
  await ctx.reply(txt);
});

composer.command("info", async (ctx: Context) => {
  const msg = ctx.message as Message;
  if (!msg) return;
  const target = msg.reply_to_message?.from || msg.from!;
  const details = [
    `ID: ${target.id}`,
    `Bot: ${target.is_bot}`,
    `Premium: ${target.is_premium ?? "N/A"}`,
    `Lang: ${target.language_code ?? "N/A"}`,
  ].join(", ");
  const lines = [
    `<b>Hunter:</b> ${target.first_name}`,
    target.username
      ? `<b>Username:</b> @${target.username}`
      : "<b>Username:</b> None",
    `<b>Details:</b> ${details}`,
  ];
  await ctx.reply(lines.join("\n"));
});

composer.command("stickerid", async (ctx: Context) => {
  const msg = ctx.message as Message;
  if (!msg) return;
  const sticker =
    msg.reply_to_message?.sticker || msg.sticker;
  if (sticker) {
    await ctx.reply(`<b>Sticker ID:</b> <code>${sticker.file_id}</code>`);
  } else {
    await ctx.reply("Reply to a sticker to learn its essence.");
  }
});

composer.command("getsticker", async (ctx: Context) => {
  const msg = ctx.message as Message;
  if (!msg) return;
  const s = msg.reply_to_message?.sticker;
  if (s) {
    await ctx.api.sendDocument(msg.chat.id, s.file_id);
  } else {
    await ctx.reply("Reply to a sticker to capture it.");
  }
});

composer.command("paste", async (ctx: Context) => {
  const msg = ctx.message as Message;
  if (!msg) return;
  let content = "";
  if (msg.reply_to_message) {
    content = msg.reply_to_message.text || msg.reply_to_message.caption || "";
  } else {
    const parts = msg.text?.split(/\s+/) || [];
    if (parts.length > 1) {
      content = parts.slice(1).join(" ");
    }
  }

  if (!content) {
    await ctx.reply("What words shall I store in the ether?");
    return;
  }

  let url = "Paste failed.";
  try {
    const resp = await fetch("https://bin.nixnet.services", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Requested-With": "JSONHttpRequest",
      },
      body: JSON.stringify({ content }),
    });
    const data = (await resp.json()) as { url?: string };
    url = `https://bin.nixnet.services/${data.url || ""}`;
  } catch {
    // paste failed
  }

  await ctx.reply(pick(PASTE_TEXTS, { url: escapeHtml(url) }));
});

composer.command("tr", async (ctx: Context) => {
  const msg = ctx.message as Message;
  if (!msg) return;
  const parts = msg.text?.split(/\s+/) || [];
  if (parts.length < 2) {
    await ctx.reply("Usage: <code>/tr &lt;lang&gt; &lt;text&gt;</code> or reply with <code>/tr &lt;lang&gt;</code>");
    return;
  }

  const targetLang = parts[1];
  let text = parts.length >= 3 ? parts.slice(2).join(" ") : "";
  if (!text && msg.reply_to_message) {
    text = msg.reply_to_message.text || msg.reply_to_message.caption || "";
  }

  if (!text) {
    await ctx.reply("I need something to translate.");
    return;
  }

  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${encodeURIComponent(targetLang)}&dt=t&q=${encodeURIComponent(text)}`;
    const resp = await fetch(url);
    const data = (await resp.json()) as any;
    const translated = data[0]?.[0]?.[0] || text;
    await ctx.reply(
      `<b>Translation (${escapeHtml(targetLang)}):</b>\n${escapeHtml(translated as string)}`,
    );
  } catch {
    await ctx.reply("Translation failed.");
  }
});

composer.command("ud", async (ctx: Context) => {
  const msg = ctx.message as Message;
  if (!msg) return;
  const parts = msg.text?.split(/\s+/) || [];
  if (parts.length < 2) {
    await ctx.reply("Usage: <code>/ud &lt;word&gt;</code>");
    return;
  }

  const word = parts.slice(1).join(" ");
  try {
    const resp = await fetch(
      `https://api.urbandictionary.com/v0/define?term=${encodeURIComponent(word)}`,
    );
    const data = (await resp.json()) as {
      list?: Array<{ word: string; definition: string; example?: string }>;
    };
    if (data.list && data.list.length > 0) {
      const entry = data.list[0];
      await ctx.reply(
        `<b>${escapeHtml(entry.word)}</b>\n\n${escapeHtml(entry.definition.slice(0, 1000))}\n\n<i>${escapeHtml((entry.example || "").slice(0, 500))}</i>`,
      );
    } else {
      await ctx.reply("No definition found in the mortal tongue.");
    }
  } catch {
    await ctx.reply("Could not reach Urban Dictionary.");
  }
});

composer.command("ping", async (ctx: Context) => {
  const msg = ctx.message as Message;
  if (!msg) return;
  await ctx.reply("<b>Pong!</b> I am here.");
});

composer.command("pong", async (ctx: Context) => {
  const msg = ctx.message as Message;
  if (!msg) return;
  await ctx.reply("<b>Ping!</b>");
});

composer.command("modules", async (ctx: Context) => {
  const msg = ctx.message as Message;
  if (!msg) return;
  const { HELPABLE } = await import("./router.js");
  if (Object.keys(HELPABLE).length > 0) {
    const names = Object.values(HELPABLE)
      .map((m) => `<code>${m.name}</code>`)
      .join(", ");
    await ctx.reply(`<b>My Arsenal:</b>\n${names}`);
  } else {
    await ctx.reply("No arts are loaded.");
  }
});
