import { Composer } from "grammy";
import type { Context } from "grammy";
import type { Message } from "grammy/types";
import {
  WELCOME_TEXTS,
  GOODBYE_TEXTS,
  pick,
} from "../utils/texts.js";
import {
  parseButtonMarkdown,
  buildKeyboard,
  requireGroup,
  escapeHtml,
} from "../utils/helpers.js";
import {
  getGroupSettings,
  saveGroupSetting,
} from "../database/models.js";

export const composer = new Composer<Context>();

export const modName = "Greetings";

export const helpText =
  "I greet new hunters when they join and bid farewell to those who leave. " +
  "Customize messages with variables, formatting, and buttons. " +
  "Welcome mute guards new members until they are verified.\n\n" +
  "<b>Greetings:</b>\n" +
  "• <code>/welcome [on/off]</code> — Toggle or view welcome messages\n" +
  "• <code>/setwelcome &lt;text&gt;</code> — Carve a welcome message\n" +
  "• <code>/resetwelcome</code> — Return to the old ways\n" +
  "• <code>/goodbye [on/off]</code> — Toggle or view farewell\n" +
  "• <code>/setgoodbye &lt;text&gt;</code> — Carve a farewell\n" +
  "• <code>/resetgoodbye</code> — Return to the old ways\n" +
  "• <code>/welcomemute &lt;mode&gt;</code> — Guard mode: off/soft/strong/captcha\n" +
  "• <code>/cleanwelcome</code> — Auto-delete old welcomes\n" +
  "• <code>/cleanservice</code> — Clean join/leave notices\n\n" +
  "Welcome variables: <code>{first}</code>, <code>{last}</code>, <code>{fullname}</code>, <code>{username}</code>, <code>{mention}</code>, <code>{id}</code>, <code>{count}</code>, <code>{chatname}</code>\n\n" +
  "<b>How it works:</b> When someone joins, I check welcome settings and send the message with variables replaced. " +
  "Buttons can be added via <code>[text](buttonurl://url)</code> syntax. " +
  "Clean welcome deletes the previous welcome before sending a new one. " +
  "Clean service removes Telegram's default join/leave notices. See /markdownhelp for formatting.";

function commandName(text: string): string {
  return text.split(/\s+/)[0].toLowerCase().split("@", 1)[0];
}

async function sendWelcome(ctx: Context, chatId: number, chatName: string, user: { id: number; first_name?: string; last_name?: string; username?: string }, serviceMessageId?: number): Promise<void> {
  const settings = await getGroupSettings(chatId);
  if (settings.clean_service && serviceMessageId) {
    try {
      await ctx.api.deleteMessage(chatId, serviceMessageId);
    } catch {
      // ignore missing delete permissions
    }
  }
  if (!settings.welcome_enabled) return;

  const previousWelcomeId = settings.last_welcome_message_id as number | undefined;
  if (settings.clean_welcome && previousWelcomeId) {
    try {
      await ctx.api.deleteMessage(chatId, previousWelcomeId);
    } catch {
      // ignore stale message ids or missing permissions
    }
  }

  const memberCount = await ctx.api.getChatMemberCount(chatId);
  const kw: Record<string, string | number> = {
    first: user.first_name || "",
    last: user.last_name || "",
    fullname: `${user.first_name || ""} ${user.last_name || ""}`.trim(),
    username: user.username ? `@${user.username}` : "",
    mention: `<a href="tg://user?id=${user.id}">${escapeHtml(user.first_name || "User")}</a>`,
    id: user.id,
    count: memberCount,
    chatname: chatName || "this camp",
  };
  let msg = (settings.welcome_message as string) ||
    pick(WELCOME_TEXTS, { first: kw.first as string, count: kw.count as number });
  try {
    msg = msg.replace(/\{(\w+)\}/g, (_, key) => String(kw[key] ?? `{${key}}`));
  } catch {
    // ignore
  }
  const buttonsText = settings.welcome_buttons as string | undefined;
  let sent;
  if (buttonsText) {
    const [, buttons] = parseButtonMarkdown(buttonsText);
    sent = await ctx.api.sendMessage(chatId, msg, { reply_markup: buildKeyboard(buttons) });
  } else {
    sent = await ctx.api.sendMessage(chatId, msg);
  }
  if (settings.clean_welcome) {
    await saveGroupSetting(chatId, { last_welcome_message_id: sent.message_id });
  }
}

async function sendGoodbye(ctx: Context, chatId: number, chatName: string, user: { id: number; first_name?: string; last_name?: string }, serviceMessageId?: number): Promise<void> {
  const settings = await getGroupSettings(chatId);
  if (settings.clean_service && serviceMessageId) {
    try {
      await ctx.api.deleteMessage(chatId, serviceMessageId);
    } catch {
      // ignore missing delete permissions
    }
  }
  if (!settings.goodbye_enabled) return;

  const memberCount = await ctx.api.getChatMemberCount(chatId);
  const kw: Record<string, string | number> = {
    first: user.first_name || "",
    fullname: `${user.first_name || ""} ${user.last_name || ""}`.trim(),
    count: memberCount,
    chatname: chatName || "this camp",
  };
  let msg = (settings.goodbye_message as string) ||
    pick(GOODBYE_TEXTS, { first: kw.first as string, count: kw.count as number });
  try {
    msg = msg.replace(/\{(\w+)\}/g, (_, key) => String(kw[key] ?? `{${key}}`));
  } catch {
    // ignore
  }
  const [clean] = parseButtonMarkdown(msg);
  await ctx.api.sendMessage(chatId, clean);
}

composer.on("chat_member", async (ctx: Context) => {
  const event = ctx.chatMember;
  if (!event) return;
  const chatId = event.chat.id;
  const newStatus = event.new_chat_member.status;
  const oldStatus = event.old_chat_member.status;
  const user = event.new_chat_member.user;

  if (
    newStatus === "member" &&
    (oldStatus === "left" || oldStatus === "kicked")
  ) {
    await sendWelcome(ctx, chatId, event.chat.title || "this camp", user);
  } else if (
    (newStatus === "left" || newStatus === "kicked") &&
    oldStatus === "member"
  ) {
    await sendGoodbye(ctx, chatId, event.chat.title || "this camp", user);
  }
});

composer.on("message:new_chat_members", async (ctx: Context) => {
  const msg = ctx.message as Message;
  if (!msg?.new_chat_members) return;
  for (const user of msg.new_chat_members) {
    await sendWelcome(ctx, msg.chat.id, msg.chat.title || "this camp", user, msg.message_id);
  }
});

composer.on("message:left_chat_member", async (ctx: Context) => {
  const msg = ctx.message as Message;
  if (!msg?.left_chat_member) return;
  await sendGoodbye(ctx, msg.chat.id, msg.chat.title || "this camp", msg.left_chat_member, msg.message_id);
});

composer.command(
  ["welcome", "setwelcome", "resetwelcome", "goodbye", "setgoodbye", "resetgoodbye", "welcomemute", "cleanwelcome", "cleanservice"],
  async (ctx: Context) => {
    const msg = ctx.message as Message;
    if (!msg || !(await requireGroup(ctx))) return;
    const text = msg.text || "";
    const cmd = commandName(text);

    if (cmd === "/welcome") {
      const settings = await getGroupSettings(msg.chat.id);
      if (text.split(/\s+/).length > 1) {
        const val = !settings.welcome_enabled;
        await saveGroupSetting(msg.chat.id, { welcome_enabled: val });
        await ctx.reply(`Welcome messages: <b>${val ? "enabled" : "disabled"}</b>`);
      } else {
        await ctx.reply(
          `Welcome: <b>${settings.welcome_enabled ? "on" : "off"}</b>\nCustom: <b>${settings.welcome_message ? "set" : "default"}</b>`,
        );
      }
    } else if (cmd === "/setwelcome") {
      let welcomeText: string;
      if (msg.reply_to_message) {
        welcomeText = msg.reply_to_message.text || msg.reply_to_message.caption || "Welcome!";
      } else {
        const parts = text.split(/\s+/);
        if (parts.length < 2) {
          await ctx.reply("Provide a welcome message or reply to one for me to carve.");
          return;
        }
        welcomeText = parts.slice(1).join(" ");
      }
      await saveGroupSetting(msg.chat.id, { welcome_message: welcomeText });
      await ctx.reply("The welcome message is set. New arrivals shall hear it.");
    } else if (cmd === "/resetwelcome") {
      await saveGroupSetting(msg.chat.id, { welcome_message: null });
      await ctx.reply("Welcome reset to the old ways.");
    } else if (cmd === "/goodbye") {
      const settings = await getGroupSettings(msg.chat.id);
      if (text.split(/\s+/).length > 1) {
        const val = !settings.goodbye_enabled;
        await saveGroupSetting(msg.chat.id, { goodbye_enabled: val });
        await ctx.reply(`Goodbye messages: <b>${val ? "enabled" : "disabled"}</b>`);
      } else {
        await ctx.reply(
          `Goodbye: <b>${settings.goodbye_enabled ? "on" : "off"}</b>\nCustom: <b>${settings.goodbye_message ? "set" : "default"}</b>`,
        );
      }
    } else if (cmd === "/setgoodbye") {
      let goodbyeText: string;
      if (msg.reply_to_message) {
        goodbyeText = msg.reply_to_message.text || msg.reply_to_message.caption || "Goodbye!";
      } else {
        const parts = text.split(/\s+/);
        if (parts.length < 2) {
          await ctx.reply("Provide a goodbye message or reply to one.");
          return;
        }
        goodbyeText = parts.slice(1).join(" ");
      }
      await saveGroupSetting(msg.chat.id, { goodbye_message: goodbyeText });
      await ctx.reply("The farewell is inscribed. Departing souls shall hear it.");
    } else if (cmd === "/resetgoodbye") {
      await saveGroupSetting(msg.chat.id, { goodbye_message: null });
      await ctx.reply("Goodbye reset to the old ways.");
    } else if (cmd === "/welcomemute") {
      const parts = text.split(/\s+/);
      if (
        parts.length > 1 &&
        ["off", "soft", "strong", "captcha"].includes(parts[1].toLowerCase())
      ) {
        await saveGroupSetting(msg.chat.id, {
          welcome_mute: parts[1].toLowerCase(),
        });
        await ctx.reply(`Welcome mute set to: <b>${parts[1].toLowerCase()}</b>`);
      } else {
        const settings = await getGroupSettings(msg.chat.id);
        await ctx.reply(
          `Current welcome mute: <b>${settings.welcome_mute}</b>\nOptions: off, soft, strong, captcha`,
        );
      }
    } else if (cmd === "/cleanwelcome") {
      const settings = await getGroupSettings(msg.chat.id);
      const val = !settings.clean_welcome;
      await saveGroupSetting(msg.chat.id, { clean_welcome: val });
      await ctx.reply(`Clean welcome: <b>${val ? "on" : "off"}</b>`);
    } else if (cmd === "/cleanservice") {
      const settings = await getGroupSettings(msg.chat.id);
      const val = !settings.clean_service;
      await saveGroupSetting(msg.chat.id, { clean_service: val });
      await ctx.reply(`Clean service: <b>${val ? "on" : "off"}</b>`);
    }
  },
);
