import { Composer } from "grammy";
import type { Context } from "grammy";
import type { Message } from "grammy/types";

export const composer = new Composer<Context>();

export const modName = "Markdown";

export const helpText =
  "Format your messages with style — works in welcomes, goodbyes, notes, and filters.\n" +
  "The bot uses <b>HTML</b> parse mode by default.\n\n" +
  "<b>Text Formatting:</b>\n" +
  "• <code>*italic*</code> → <i>italic</i>\n" +
  "• <code>**bold**</code> → <b>bold</b>\n" +
  "• <code>`code`</code> → <code>code</code>\n" +
  "• <code>```pre```</code> → pre-formatted\n" +
  "• <code>[text](url)</code> → inline link\n" +
  "• <code>~~strikethrough~~</code> → strikethrough\n\n" +
  "You can also use raw HTML tags: <code>&lt;b&gt;bold&lt;/b&gt;</code>, <code>&lt;i&gt;italic&lt;/i&gt;</code>, etc.\n\n" +
  "<b>Buttons:</b>\n" +
  "Add buttons at the end of your message:\n" +
  "<code>[Button Text](buttonurl://https://example.com)</code>\n" +
  "<code>[Inline Button](buttonurl://https://example.com:same)</code>\n" +
  "<code>:same</code> keeps the button on the same row.\n\n" +
  "<b>Variables (Welcome / Goodbye / Notes / Filters):</b>\n" +
  "• <code>{first}</code> — first name\n" +
  "• <code>{last}</code> — last name\n" +
  "• <code>{fullname}</code> — full name\n" +
  "• <code>{username}</code> — @username\n" +
  "• <code>{mention}</code> — clickable mention\n" +
  "• <code>{id}</code> — numeric ID\n" +
  "• <code>{count}</code> — member count\n" +
  "• <code>{chatname}</code> — group name\n\n" +
  "<b>Example welcome:</b>\n" +
  `<pre>Welcome, {first}!\n` +
  `[Rules](buttonurl://https://example.com/rules)\n` +
  `[Support](buttonurl://https://example.com/support:same)</pre>\n\n` +
  "All formatting, buttons, and variables work in welcomes, goodbyes, notes, and filter replies.";

composer.command("markdownhelp", async (ctx: Context) => {
  const msg = ctx.message as Message;
  if (!msg) return;
  if (msg.chat.type !== "private") {
    await ctx.reply("Check your private messages for the markdown guide.");
    return;
  }

  const text =
    "<b>Markdown formatting guide (live preview):</b>\n\n" +
    "<code>*italic*</code> → <i>italic</i>\n" +
    "<code>**bold**</code> → <b>bold</b>\n" +
    "<code>`code`</code> → <code>code</code>\n" +
    "<code>```pre```</code> → pre\n" +
    "<code>[text](url)</code> → <a href=\"https://example.com\">link</a>\n" +
    "<code>~~strikethrough~~</code> → <s>strikethrough</s>\n\n" +
    "<b>Buttons:</b>\n" +
    "<code>[text](buttonurl://url)</code>\n" +
    "<code>[text](buttonurl://url:same)</code> — same row\n\n" +
    "<b>Welcome variables:</b>\n" +
    "<code>{first}</code> <code>{last}</code> <code>{fullname}</code> <code>{username}</code>\n" +
    "<code>{mention}</code> <code>{id}</code> <code>{count}</code> <code>{chatname}</code>";

  await ctx.reply(text, { parse_mode: "HTML" });
});
