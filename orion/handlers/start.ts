import { Composer } from "grammy";
import type { Context } from "grammy";
import type { Message } from "grammy/types";
import {
  ABOUT_TEXT,
  PM_START_TEXTS,
  GROUP_START_TEXTS,
  HELP_TEXTS,
  pick,
} from "../utils/texts.js";
import { paginateModules } from "../utils/helpers.js";
import { startKeyboard, aboutKeyboard, groupHelpKeyboard, helpBackKeyboard } from "../keyboards/common.js";
import { getUser, saveUser, getChat, saveChat, saveMember } from "../database/models.js";
import { HELPABLE } from "./router.js";

export const composer = new Composer<Context>();

composer.command("start", async (ctx: Context) => {
  const msg = ctx.message as Message;
  if (!msg) return;
  const chat = msg.chat;
  const user = msg.from;
  if (!user) return;
  const uid = user.id;

  const existing = await getUser(uid);
  await saveUser(uid, {
    username: user.username,
    first_name: user.first_name,
    last_name: user.last_name,
    is_bot: user.is_bot,
  });

  if (chat.type !== "private") {
    const existingChat = await getChat(chat.id);
    if (!existingChat) {
      await saveChat(chat.id, {
        title: chat.title,
        username: chat.username,
        type: chat.type,
      });
    }
    await saveMember(uid, chat.id);
  }

  if (chat.type === "private") {
    const text = msg.text || "";
    const args = text.split(" ").slice(1).join(" ");

    if (args) {
      if (args.toLowerCase().startsWith("ghelp_")) {
        const mod = args.toLowerCase().split("_", 2)[1];
        if (mod in HELPABLE) {
          const helpList = HELPABLE[mod].help;
          const helpText = `<b>${HELPABLE[mod].name}</b>\n\n${helpList}`;
          await ctx.reply(helpText, { reply_markup: helpBackKeyboard() });
        }
        return;
      }

      if (args.toLowerCase() === "help") {
        await showHelp(ctx);
        return;
      }
    }

    await ctx.reply(pick(PM_START_TEXTS, { user: user.first_name || "Hunter" }), {
      reply_markup: startKeyboard(),
    });
  } else {
    await ctx.reply(pick(GROUP_START_TEXTS));
  }
});

async function showHelp(
  ctx: Context,
  text?: string,
): Promise<void> {
  const kb = paginateModules(HELPABLE, "help");
  if (ctx.callbackQuery) {
    await ctx.editMessageText(text || pick(HELP_TEXTS), {
      reply_markup: kb,
    });
  } else {
    await ctx.reply(text || pick(HELP_TEXTS), { reply_markup: kb });
  }
}

composer.callbackQuery("start_back", async (ctx: Context) => {
  const user = ctx.from;
  if (!user) return;
  await ctx.editMessageText(pick(PM_START_TEXTS, { user: user.first_name || "Hunter" }), {
    reply_markup: startKeyboard(),
  });
  await ctx.answerCallbackQuery();
});

composer.callbackQuery("about_me", async (ctx: Context) => {
  await ctx.editMessageText(ABOUT_TEXT, { reply_markup: aboutKeyboard() });
  await ctx.answerCallbackQuery();
});

composer.callbackQuery("about_back", async (ctx: Context) => {
  const user = ctx.from;
  if (!user) return;
  await ctx.editMessageText(pick(PM_START_TEXTS, { user: user.first_name || "Hunter" }), {
    reply_markup: startKeyboard(),
  });
  await ctx.answerCallbackQuery();
});


composer.callbackQuery(/^help_/, async (ctx: Context) => {
  const cq = ctx.callbackQuery!;
  const data = cq.data!;

  const modMatch = data.match(/^help_module\((.+?)\)/);
  const backMatch = data === "help_back";

  if (modMatch) {
    const mod = modMatch[1];
    if (mod in HELPABLE) {
      const helpTexts = HELPABLE[mod].help;
      const helpText = Array.isArray(helpTexts) ? helpTexts[0] : helpTexts;
      const txt = `<b>${HELPABLE[mod].name}</b>\n\n${helpText}`;
      await ctx.editMessageText(txt, { reply_markup: helpBackKeyboard() });
    }
  } else if (backMatch) {
    await showHelp(ctx);
  }

  await ctx.answerCallbackQuery();
});

composer.command("help", async (ctx: Context) => {
  const msg = ctx.message as Message;
  if (!msg) return;
  const chat = msg.chat;
  const text = msg.text || "";
  const args = text.split(" ").slice(1).join(" ");

  if (chat.type !== "private") {
    const lowerArgs = args.toLowerCase();
    if (lowerArgs in HELPABLE) {
      const mod = lowerArgs;
      const helpTexts = HELPABLE[mod].help;
      const txt = Array.isArray(helpTexts)
        ? `<b>${HELPABLE[mod].name}</b>\n\n${helpTexts[0]}`
        : `<b>${HELPABLE[mod].name}</b>\n\n${helpTexts}`;
      await ctx.reply(txt, { reply_markup: helpBackKeyboard() });
    } else {
      await ctx.reply("Speak to me privately to learn the hunter's arts.", {
        reply_markup: groupHelpKeyboard(),
      });
    }
    return;
  }

  if (args && args.toLowerCase() in HELPABLE) {
    const mod = args.toLowerCase();
    const helpTexts = HELPABLE[mod].help;
    const txt = Array.isArray(helpTexts)
      ? `<b>${HELPABLE[mod].name}</b>\n\n${helpTexts[0]}`
      : `<b>${HELPABLE[mod].name}</b>\n\n${helpTexts}`;
    await ctx.reply(txt, { reply_markup: helpBackKeyboard() });
  } else {
    await showHelp(ctx);
  }
});
