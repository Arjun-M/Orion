import { Composer } from "grammy";
import type { Context } from "grammy";
import type { Message } from "grammy/types";
import {
  DEMOTE_TEXTS,
  NOT_ADMIN_TEXTS,
  PIN_TEXTS,
  PROMOTE_TEXTS,
  pick,
} from "../utils/texts.js";
import { requireGroup, escapeHtml } from "../utils/helpers.js";
import { isAdmin, fetchAndCacheAdmins } from "../utils/permissions.js";

export const composer = new Composer<Context>();

export const modName = "Admin";

export const helpText =
  "A camp needs structure. I bestow ranks, pin messages, and reveal those who lead. " +
  "Admin commands require the user to be a group admin (cached for performance).\n\n" +
  "<b>Commands:</b>\n" +
  "• <code>/promote &lt;user&gt;</code> — Raise a hunter to scribe\n" +
  "• <code>/demote &lt;user&gt;</code> — Lower a scribe\n" +
  "• <code>/title &lt;user&gt; &lt;text&gt;</code> — Bestow a custom title (max 16 chars)\n" +
  "• <code>/pin [notify]</code> — Pin a message to the stars\n" +
  "• <code>/unpin</code> — Release a pinned star\n" +
  "• <code>/invitelink</code> — Share the hunting grounds\n" +
  "• <code>/admins</code> — Name all leaders of this camp\n\n" +
  "<b>How it works:</b> Admin status is cached per-group and refreshed when someone is promoted/demoted " +
  "or via <code>/admins</code>. Only group creator and administrators can use these commands.";


async function isGroupAdmin(ctx: Context): Promise<boolean> {
  const msg = ctx.message as Message | undefined;
  const user = msg?.from;
  if (!msg || !user) return false;
  return isAdmin(msg.chat.id, user.id);
}

async function requireGroupAdmin(ctx: Context): Promise<boolean> {
  if (!(await requireGroup(ctx))) return false;
  if (await isGroupAdmin(ctx)) return true;
  await ctx.reply(pick(NOT_ADMIN_TEXTS));
  return false;
}

function commandArgs(msg: Message): string[] {
  return (msg.text || "").split(/\s+/).slice(1);
}

function targetFromReplyOrMention(msg: Message) {
  if (msg.reply_to_message?.from) return msg.reply_to_message.from;
  const entity = msg.entities?.find((e) => e.type === "text_mention");
  return entity && "user" in entity ? entity.user : null;
}
composer.command("promote", async (ctx: Context) => {
  const msg = ctx.message as Message;
  if (!msg || !(await requireGroupAdmin(ctx))) return;
  const target = targetFromReplyOrMention(msg);
  if (!target) {
    await ctx.reply("Reply to a user, or mention them with Telegram's text mention, to promote them.");
    return;
  }
  await ctx.api.promoteChatMember(msg.chat.id, target.id, {
    can_delete_messages: true,
    can_restrict_members: true,
    can_invite_users: true,
    can_pin_messages: true,
    can_manage_chat: true,
  });
  await ctx.reply(pick(PROMOTE_TEXTS, { user: escapeHtml(target.first_name) }));
});

composer.command("demote", async (ctx: Context) => {
  const msg = ctx.message as Message;
  if (!msg || !(await requireGroupAdmin(ctx))) return;
  const target = targetFromReplyOrMention(msg);
  if (!target) {
    await ctx.reply("Reply to a user, or mention them with Telegram's text mention, to demote them.");
    return;
  }
  await ctx.api.promoteChatMember(msg.chat.id, target.id, {
    can_change_info: false,
    can_post_messages: false,
    can_edit_messages: false,
    can_delete_messages: false,
    can_invite_users: false,
    can_restrict_members: false,
    can_pin_messages: false,
    can_promote_members: false,
    can_manage_chat: false,
    can_manage_video_chats: false,
  });
  await ctx.reply(pick(DEMOTE_TEXTS, { user: escapeHtml(target.first_name) }));
});

composer.command("title", async (ctx: Context) => {
  const msg = ctx.message as Message;
  if (!msg || !(await requireGroupAdmin(ctx))) return;
  const target = targetFromReplyOrMention(msg);
  const args = commandArgs(msg);
  const title = msg.reply_to_message ? args.join(" ") : args.slice(1).join(" ");
  if (!target || !title) {
    await ctx.reply("Usage: reply with <code>/title &lt;text&gt;</code>.");
    return;
  }
  await ctx.api.setChatAdministratorCustomTitle(msg.chat.id, target.id, title.slice(0, 16));
  await ctx.reply(`<b>${escapeHtml(target.first_name)}</b> now bears the title <b>${escapeHtml(title.slice(0, 16))}</b>.`);
});

composer.command("pin", async (ctx: Context) => {
  const msg = ctx.message as Message;
  if (!msg || !(await requireGroupAdmin(ctx))) return;
  const target = msg.reply_to_message;
  if (!target) {
    await ctx.reply("Reply to a message I should pin.");
    return;
  }
  const notify = commandArgs(msg).some((arg) => ["notify", "loud"].includes(arg.toLowerCase()));
  await ctx.api.pinChatMessage(msg.chat.id, target.message_id, { disable_notification: !notify });
  await ctx.reply(pick(PIN_TEXTS));
});

composer.command("unpin", async (ctx: Context) => {
  const msg = ctx.message as Message;
  if (!msg || !(await requireGroupAdmin(ctx))) return;
  if (msg.reply_to_message) {
    await ctx.api.unpinChatMessage(msg.chat.id, msg.reply_to_message.message_id);
  } else {
    await ctx.api.unpinChatMessage(msg.chat.id);
  }
  await ctx.reply("The pinned star is released.");
});

composer.command("invitelink", async (ctx: Context) => {
  const msg = ctx.message as Message;
  if (!msg) return;
  if (!(await requireGroupAdmin(ctx))) return;
  const chat = await ctx.api.getChat(msg.chat.id);
  const link = chat.username
    ? `https://t.me/${chat.username}`
    : await ctx.api.exportChatInviteLink(msg.chat.id);
  await ctx.reply(`<b>Hunting Grounds:</b> ${link}`);
});

composer.command("admins", async (ctx: Context) => {
  const msg = ctx.message as Message;
  if (!msg) return;
  if (!(await requireGroup(ctx))) return;
  const admins = await fetchAndCacheAdmins(msg.chat.id, ctx.api);
  const lines = ["<b>Camp Leaders:</b>"];
  for (const a of admins) {
    const user = a.user;
    const title = "custom_title" in a && a.custom_title
      ? a.custom_title
      : a.status === "creator"
        ? "Creator"
        : "Admin";
    const name = user.username
      ? `@${escapeHtml(user.username)}`
      : escapeHtml(user.first_name);
    lines.push(`• ${name} — <i>${escapeHtml(title)}</i>`);
  }
  await ctx.reply(lines.join("\n"));
});
