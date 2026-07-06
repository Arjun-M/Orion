import { Composer } from "grammy";
import type { Context } from "grammy";
import type { Message } from "grammy/types";
import { NOT_ADMIN_TEXTS, REPORT_TEXTS, pick } from "../utils/texts.js";
import {
  getGroupSettings,
  saveGroupSetting,
} from "../database/models.js";
import { requireGroup } from "../utils/helpers.js";
import { isAdmin } from "../utils/permissions.js";

export const composer = new Composer<Context>();

export const modName = "Reporting";


async function requireGroupAdmin(ctx: Context): Promise<boolean> {
  const msg = ctx.message as Message | undefined;
  const user = msg?.from;
  if (!msg || !user || !(await requireGroup(ctx))) return false;
  if (await isAdmin(msg.chat.id, user.id)) return true;
  await ctx.reply(pick(NOT_ADMIN_TEXTS));
  return false;
}

const adminMentionRx = /(?:^|\s)@admins?\b/i;

composer.on("message:text", async (ctx: Context) => {
  const msg = ctx.message as Message;
  if (!msg || msg.chat.type === "private") return;
  const text = msg.text || "";
  if (!adminMentionRx.test(text)) return;
  if (text.startsWith("/")) return;

  const settings = await getGroupSettings(msg.chat.id);
  if (!settings.reports_enabled) return;

  const admins = await ctx.api.getChatAdministrators(msg.chat.id);
  const mention = `<a href="tg://user?id=${msg.from!.id}">${msg.from!.first_name}</a>`;
  const txt = `<b>Report from ${mention}</b>:\n${text}`;

  for (const a of admins) {
    if (!a.user.is_bot) {
      try {
        await ctx.api.sendMessage(a.user.id, `🚨 <b>@admin in ${msg.chat.title}</b>:\n${txt}`);
      } catch {
        // ignore
      }
    }
  }
  await ctx.reply("The camp leaders have been alerted.");
});

export const helpText =
  "When you spot a beast, summon the hunters. " +
  "Reports are sent privately to every admin in the camp, along with the reporter's identity and the context.\n\n" +
  "<b>Commands:</b>\n" +
  "• <code>/report</code> (reply to a message) — Call the camp leaders to action\n" +
  "• <code>/reports</code> — Toggle whether reporting is enabled\n\n" +
  "<b>@admin mention:</b> Typing <code>@admin</code> or <code>@admins</code> in a group message also " +
  "alerts all admins with your message content.\n\n" +
  "<b>How it works:</b> When a report is triggered, I fetch the admin list and send a private message to each. " +
  "Only admins can enable/disable reporting. Reports are not anonymous — admins see who reported.";

composer.command("report", async (ctx: Context) => {
  const msg = ctx.message as Message;
  if (!msg || !(await requireGroup(ctx))) return;
  const target = msg.reply_to_message?.from;
  if (!target) {
    await ctx.reply("Reply to someone to report them.");
    return;
  }

  const settings = await getGroupSettings(msg.chat.id);

  if (settings.reports_enabled) {
    const admins = await ctx.api.getChatAdministrators(msg.chat.id);
    const mention = `<a href="tg://user?id=${msg.from!.id}">${msg.from!.first_name}</a>`;
    const targetMention = `<a href="tg://user?id=${target.id}">${target.first_name}</a>`;
    const txt = pick(REPORT_TEXTS, {
      user: targetMention,
      reporter: mention,
    });

    const notified: string[] = [];
    for (const a of admins) {
      if (!a.user.is_bot) {
        try {
          await ctx.api.sendMessage(
            a.user.id,
            `🚨 <b>Report in ${msg.chat.title}</b>:\n${txt}`,
          );
          notified.push(a.user.first_name);
        } catch {
          // ignore
        }
      }
    }

    if (notified.length > 0) {
      await ctx.reply(`<b>${notified.length}</b> leaders have been alerted.`);
    } else {
      await ctx.reply("No leaders could be reached. They may have barred my voice.");
    }
  } else {
    await ctx.reply("Reporting is disabled in this camp.");
  }
});

composer.command("reports", async (ctx: Context) => {
  const msg = ctx.message as Message;
  if (!msg || !(await requireGroupAdmin(ctx))) return;
  const settings = await getGroupSettings(msg.chat.id);
  const current = settings.reports_enabled !== false;
  await saveGroupSetting(msg.chat.id, { reports_enabled: !current });
  await ctx.reply(`Reporting <b>${!current ? "enabled" : "disabled"}</b>.`);
});

composer.command("settings", async (ctx: Context) => {
  const msg = ctx.message as Message;
  if (!msg || !(await requireGroup(ctx))) return;
  const settings = await getGroupSettings(msg.chat.id);

  if (!settings || settings._id == null) {
    await ctx.reply("No settings are written for this camp yet.");
    return;
  }

  const lines = [
    `<b>Camp Configuration:</b>`,
    `Welcome: <b>${settings.welcome_enabled ? "on" : "off"}</b>`,
    `Goodbye: <b>${settings.goodbye_enabled ? "on" : "off"}</b>`,
    `Welcome mute: <b>${settings.welcome_mute}</b>`,
    `Warn limit: <b>${settings.warn_limit}</b> (soft: <b>${settings.soft_warn}</b>)`,
    `Flood: <b>${settings.flood_limit}</b> msgs, action: <b>${settings.flood_action}</b>`,
    `Reports: <b>${settings.reports_enabled ? "on" : "off"}</b>`,
    `GBAN: <b>${settings.gban_enabled ? "on" : "off"}</b>`,
  ];
  await ctx.reply(lines.join("\n"));
});
