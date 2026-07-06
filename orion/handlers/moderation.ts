import { Composer } from "grammy";
import type { Context } from "grammy";
import type { Message, User } from "grammy/types";
import {
  BAN_TEXTS,
  UNBAN_TEXTS,
  KICK_TEXTS,
  MUTE_TEXTS,
  UNMUTE_TEXTS,
  WARN_TEXTS,
  RESET_WARN_TEXTS,
  pick,
} from "../utils/texts.js";
import { extractTime, requireGroup, escapeHtml } from "../utils/helpers.js";
import {
  getWarns,
  addWarn,
  resetWarns,
  getGroupSettings,
} from "../database/models.js";

export const composer = new Composer<Context>();

export const modName = "Bans & Mute";

export const helpText =
  "When beasts must be cast out or silenced, I am the spear that strikes true.\n\n" +
  "<b>Commands:</b>\n" +
  "• <code>/ban &lt;user&gt; [reason]</code> — Cast a soul beyond the pale\n" +
  "• <code>/tban &lt;user&gt; &lt;time&gt;</code> — Temporary exile\n" +
  "• <code>/unban &lt;user&gt;</code> — Recall an exile\n" +
  "• <code>/kick &lt;user&gt;</code> — A sharp shove out the gates\n" +
  "• <code>/kickme</code> — For those who wish to depart\n" +
  "• <code>/mute &lt;user&gt; [time]</code> — Silence a loud voice\n" +
  "• <code>/unmute &lt;user&gt;</code> — Restore a voice\n" +
  "• <code>/warn &lt;user&gt; [reason]</code> — Mark a user with an arrow\n" +
  "• <code>/warns [user]</code> — Count their arrows\n" +
  "• <code>/resetwarn &lt;user&gt;</code> — Cleanse all arrows\n\n" +
  "<b>Time formats:</b> <code>1m</code>, <code>2h</code>, <code>3d</code>, <code>1w</code>\n\n" +
  "<b>How it works:</b> Warnings stack per-user per-group. When a user's warns reach the limit (set in Filters), " +
  "they are automatically banned. Only group admins can use these commands. " +
  "Use reply or mention to target a user.";

async function getUser(
  ctx: Context,
  text: string,
): Promise<User | null> {
  const msg = ctx.message as Message;
  if (!msg) return null;
  if (msg.reply_to_message?.from) {
    return msg.reply_to_message.from;
  }
  const args = text ? text.split(/\s+/).slice(1) : [];
  if (args.length > 0) {
    const arg = args[0];
    if (arg.startsWith("@")) {
      try {
        const members = await ctx.api.getChatAdministrators(msg.chat.id);
        for (const m of members) {
          if (m.user.username?.toLowerCase() === arg.slice(1).toLowerCase()) {
            return m.user;
          }
        }
      } catch {
        // ignore
      }
    }
  }
  return null;
}

composer.command("ban", async (ctx: Context) => {
  const msg = ctx.message as Message;
    if (!msg || !(await requireGroup(ctx))) return;
  const user = await getUser(ctx, msg.text || "");
  if (!user) {
    await ctx.reply("Reply to or @mention the one I should hunt.");
    return;
  }
  const parts = msg.text?.split(/\s+/) || [];
  const reason = parts.slice(2).join(" ") || "No reason given";

  if (user.is_bot) {
    await ctx.api.banChatSenderChat(msg.chat.id, user.id);
  } else {
    await ctx.api.banChatMember(msg.chat.id, user.id);
  }
  await ctx.reply(pick(BAN_TEXTS, { user: escapeHtml(user.first_name) }));
});

composer.command("tban", async (ctx: Context) => {
  const msg = ctx.message as Message;
    if (!msg || !(await requireGroup(ctx))) return;
  const user = await getUser(ctx, msg.text || "");
  if (!user) {
    await ctx.reply("Reply to or @mention the one I should temporarily hunt.");
    return;
  }
  const parts = msg.text?.split(/\s+/) || [];
  if (parts.length < 2) {
    await ctx.reply("Specify time after the target. Example: <code>/tban 2h</code>");
    return;
  }
  const seconds = extractTime(parts[1]);
  if (!seconds) {
    await ctx.reply("Invalid time. Use <code>1m</code>, <code>2h</code>, <code>3d</code>, etc.");
    return;
  }
  const until = new Date(Date.now() + seconds * 1000);
  await ctx.api.banChatMember(msg.chat.id, user.id, {
    until_date: Math.floor(until.getTime() / 1000),
  });
  await ctx.reply(
    `<b>${escapeHtml(user.first_name)}</b> is hunted until <b>${until.toISOString().replace("T", " ").slice(0, 19)} UTC</b>.`,
  );
});

composer.command("unban", async (ctx: Context) => {
  const msg = ctx.message as Message;
    if (!msg || !(await requireGroup(ctx))) return;
  const user = await getUser(ctx, msg.text || "");
  if (!user) {
    await ctx.reply("Reply to or @mention the one I should recall from exile.");
    return;
  }
  await ctx.api.unbanChatMember(msg.chat.id, user.id);
  await ctx.reply(pick(UNBAN_TEXTS, { user: escapeHtml(user.first_name) }));
});

composer.command("kick", async (ctx: Context) => {
  const msg = ctx.message as Message;
    if (!msg || !(await requireGroup(ctx))) return;
  const user = await getUser(ctx, msg.text || "");
  if (!user) {
    await ctx.reply("Reply to or @mention the one I should shove out.");
    return;
  }
  await ctx.api.banChatMember(msg.chat.id, user.id);
  await ctx.api.unbanChatMember(msg.chat.id, user.id);
  await ctx.reply(pick(KICK_TEXTS, { user: escapeHtml(user.first_name) }));
});

composer.command("mute", async (ctx: Context) => {
  const msg = ctx.message as Message;
    if (!msg || !(await requireGroup(ctx))) return;
  const user = await getUser(ctx, msg.text || "");
  if (!user) {
    await ctx.reply("Reply to or @mention the one I should silence.");
    return;
  }
  const parts = msg.text?.split(/\s+/) || [];
  if (parts.length >= 2 && /^\d/.test(parts[1])) {
    const seconds = extractTime(parts[1]);
    if (seconds) {
      const until = new Date(Date.now() + seconds * 1000);
      await ctx.api.restrictChatMember(msg.chat.id, user.id, {
        can_send_messages: false,
      }, {
        until_date: Math.floor(until.getTime() / 1000),
      });
      await ctx.reply(`<b>${user.first_name}</b> silenced for <b>${parts[1]}</b>.`);
      return;
    }
  }
  await ctx.api.restrictChatMember(msg.chat.id, user.id, { can_send_messages: false });
  await ctx.reply(pick(MUTE_TEXTS, { user: escapeHtml(user.first_name) }));
});

composer.command("unmute", async (ctx: Context) => {
  const msg = ctx.message as Message;
    if (!msg || !(await requireGroup(ctx))) return;
  const user = await getUser(ctx, msg.text || "");
  if (!user) {
    await ctx.reply("Reply to or @mention the one I should free.");
    return;
  }
  await ctx.api.restrictChatMember(msg.chat.id, user.id, {
    can_send_messages: true,
    can_send_other_messages: true,
    can_add_web_page_previews: true,
  });
  await ctx.reply(pick(UNMUTE_TEXTS, { user: escapeHtml(user.first_name) }));
});

composer.command("kickme", async (ctx: Context) => {
  const msg = ctx.message as Message;
    if (!msg || !(await requireGroup(ctx))) return;
  await ctx.api.unbanChatMember(msg.chat.id, msg.from!.id);
  await ctx.reply("You have asked to leave. So be it. The hunt continues without you.");
});

composer.command("warn", async (ctx: Context) => {
  const msg = ctx.message as Message;
    if (!msg || !(await requireGroup(ctx))) return;
  const user = await getUser(ctx, msg.text || "");
  if (!user) {
    await ctx.reply("Reply to or @mention the one I should mark with an arrow.");
    return;
  }

  const parts = msg.text?.split(/\s+/) || [];
  const reason = parts.slice(2).join(" ") || "No reason";

  await addWarn(user.id, msg.chat.id, reason, msg.from!.id);
  const warns = await getWarns(user.id, msg.chat.id);
  const warnCount = warns.length;

  const settings = await getGroupSettings(msg.chat.id);
  const limit = (settings.warn_limit as number) || 3;

  if (warnCount >= limit) {
    await ctx.api.banChatMember(msg.chat.id, user.id);
    await ctx.reply(
      `<b>${escapeHtml(user.first_name)}</b> has been cast out. Too many arrows find their mark.`,
    );
  } else {
    await ctx.reply(
      pick(WARN_TEXTS, {
        user: escapeHtml(user.first_name),
        reason: escapeHtml(reason),
        warns: warnCount,
        limit,
      }),
    );
  }
});

composer.command("resetwarn", async (ctx: Context) => {
  const msg = ctx.message as Message;
    if (!msg || !(await requireGroup(ctx))) return;
  const user = await getUser(ctx, msg.text || "");
  if (!user) {
    await ctx.reply("Reply to or @mention the one whose arrows I should pluck.");
    return;
  }

  await resetWarns(user.id, msg.chat.id);
  await ctx.reply(pick(RESET_WARN_TEXTS, { user: escapeHtml(user.first_name) }));
});

composer.command("warns", async (ctx: Context) => {
  const msg = ctx.message as Message;
    if (!msg || !(await requireGroup(ctx))) return;
  const user = (await getUser(ctx, msg.text || "")) || msg.from!;

  const warns = await getWarns(user.id, msg.chat.id);

  if (warns.length > 0) {
    const lines = [
      `<b>${escapeHtml(user.first_name)}</b> carries <b>${warns.length}</b> arrow(s):`,
    ];
    for (const w of warns) {
      lines.push(
        `• <i>${escapeHtml((w.reason as string) || "No reason")}</i> (by <code>${w.warned_by}</code>)`,
      );
    }
    await ctx.reply(lines.join("\n"));
  } else {
    await ctx.reply(
      `<b>${escapeHtml(user.first_name)}</b> has no arrows. A clean record.`,
    );
  }
});
