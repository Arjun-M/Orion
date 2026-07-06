import { Composer } from "grammy";
import type { Context } from "grammy";
import type { Message } from "grammy/types";

export const composer = new Composer<Context>();

export const modName = "Formatting";

export const helpText =
  "Learn how to write styled messages. These tricks work in welcomes, goodbyes, notes, and filters.\n\n" +
  "<b>Text Formatting (Markdown):</b>\n" +
  "• <code>*italic*</code> → italic\n" +
  "• <code>**bold**</code> → bold\n" +
  "• <code>`code`</code> → code\n" +
  "• <code>```pre```</code> → pre-formatted\n" +
  "• <code>[text](url)</code> → inline link\n" +
  "• <code>~~strikethrough~~</code> → strikethrough\n\n" +
  "<b>Welcome / Goodbye Variables:</b>\n" +
  "• <code>{first}</code> — first name\n" +
  "• <code>{last}</code> — last name\n" +
  "• <code>{fullname}</code> — full name\n" +
  "• <code>{username}</code> — @username\n" +
  "• <code>{mention}</code> — clickable mention\n" +
  "• <code>{id}</code> — numeric ID\n" +
  "• <code>{count}</code> — member count\n" +
  "• <code>{chatname}</code> — group name\n\n" +
  "<b>Buttons in welcomes &amp; notes:</b>\n" +
  "Add buttons at the end of your message:\n" +
  "<code>[Button Text](buttonurl://https://example.com)</code>\n" +
  "<code>[Inline Button](buttonurl://https://example.com:same)</code>\n\n" +
  "<code>:same</code> keeps the button on the same row.\n\n" +
  "<b>Example:</b>\n" +
  "<pre>Welcome, {first}!\n" +
  "[Rules](buttonurl://https://t.me/OrionGroupBot?start=rules)\n" +
  "[Support](buttonurl://https://t.me/CBotics:same)</pre>\n\n" +
  "Use /markdownhelp in PM for a live preview.";

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
