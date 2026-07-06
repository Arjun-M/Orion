import { Composer } from "grammy";
import type { Context } from "grammy";
import type { Message } from "grammy/types";
import { NOT_ADMIN_TEXTS, REPORT_TEXTS, pick } from "../utils/texts.js";
import {
  getGroupSettings,
  saveGroupSetting,
} from "../database/models.js";
import { requireGroup } from "../utils/helpers.js";
import { OWNER_IDS, SUDO_USERS } from "../utils/permissions.js";

export const composer = new Composer<Context>();

export const modName = "Reporting";


async function requireGroupAdmin(ctx: Context): Promise<boolean> {
  const msg = ctx.message as Message | undefined;
  const user = msg?.from;
  if (!msg || !user || !(await requireGroup(ctx))) return false;
  if (OWNER_IDS.has(user.id) || SUDO_USERS.has(user.id)) return true;
  try {
    const member = await ctx.api.getChatMember(msg.chat.id, user.id);
    if (member.status === "creator" || member.status === "administrator") return true;
  } catch {
    // ignore
  }
  await ctx.reply(pick(NOT_ADMIN_TEXTS));
  return false;
}

export const helpText =
  "When you spot a beast, summon the hunters.\n\n" +
  "<b>Commands:</b>\n" +
  "• <code>/report &lt;user&gt;</code> — Call the camp leaders to action\n" +
  "• <code>/reports</code> — Toggle whether reporting is enabled\n\n" +
  "Reports are sent privately to all admins. Do not abuse.";

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
