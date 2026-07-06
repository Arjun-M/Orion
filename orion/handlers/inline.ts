import { Composer, InlineKeyboard } from "grammy";
import type { Context } from "grammy";
import { config } from "../config.js";

export const composer = new Composer<Context>();

composer.on("inline_query", async (ctx: Context) => {
  const query = ctx.inlineQuery!;
  const text = query.query.trim().toLowerCase();
  const results: Array<{
    type: "article";
    id: string;
    title: string;
    description: string;
    input_message_content: { message_text: string };
    reply_markup?: ReturnType<typeof InlineKeyboard.from>;
  }> = [];

  if (!text) {
    results.push({
      type: "article",
      id: crypto.randomUUID(),
      title: "Orion — The Hunter",
      description: "Group management bot by Arjun-M",
      input_message_content: {
        message_text:
          "I am <b>Orion</b>, the hunter who walks among the stars.\nAdd me to your camp: t.me/OrionGroupBot?startgroup=true",
      },
      reply_markup: InlineKeyboard.from([
        [
          {
            text: "Add to Group",
            url: `https://t.me/${config.botUsername}?startgroup=true`,
          },
        ],
      ]),
    });
  } else {
    results.push({
      type: "article",
      id: crypto.randomUUID(),
      title: `Hunt for: ${text}`,
      description: "Search not yet implemented — I only hunt what I can see.",
      input_message_content: {
        message_text: `I heard you mention '<b>${text}</b>'. The hunt is afoot.`,
      },
    });
  }

  await ctx.answerInlineQuery(results, {
    cache_time: 1,
    is_personal: true,
  });
});
