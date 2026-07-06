import { randomUUID } from "node:crypto";
import { Composer } from "grammy";
import type { Context } from "grammy";
import type { Message } from "grammy/types";
import {
  FED_CREATE_TEXTS,
  FED_BAN_TEXTS,
  FED_UNBAN_TEXTS,
  pick,
} from "../utils/texts.js";
import { escapeHtml, requireGroup } from "../utils/helpers.js";
import {
  getFederation,
  createFederation,
  listFederations,
  deleteFederation,
  getChatFederation,
  setChatFederation,
  removeChatFederation,
  getFedBans,
  addFedBan,
  removeFedBan,
  upsert,
} from "../database/models.js";

export const composer = new Composer<Context>();

export const modName = "Federation";

export const helpText =
  "Federations bind camps together against common beasts. A single ban echoes across all allied lands.\n\n" +
  "<b>Commands:</b>\n" +
  "• <code>/newfed &lt;name&gt;</code> — Found an alliance (in PM)\n" +
  "• <code>/renamefed &lt;name&gt;</code> — Rename your alliance\n" +
  "• <code>/joinfed &lt;id&gt;</code> — Join an existing alliance\n" +
  "• <code>/leavefed</code> — Depart from your alliance\n" +
  "• <code>/fpromote &lt;user&gt;</code> — Promote a member to admin\n" +
  "• <code>/fdemote &lt;user&gt;</code> — Demote an admin\n" +
  "• <code>/fban &lt;user&gt; [reason]</code> — Hunt across all allied camps\n" +
  "• <code>/unfban &lt;user&gt;</code> — Stop the cross-camp hunt\n" +
  "• <code>/fbanlist</code> — See all hunted across the alliance\n" +
  "• <code>/feds</code> — List your alliances\n" +
  "• <code>/chatfed</code> — See this camp's alliance\n" +
  "• <code>/setfrules &lt;text&gt;</code> — Write alliance law\n\n" +
  "Only the alliance founder may rename, promote, or set rules.";


async function requirePrivate(ctx: Context): Promise<boolean> {
  const msg = ctx.message as Message | undefined;
  if (msg?.chat.type === "private") return true;
  await ctx.reply("Speak to me privately to found a new alliance.");
  return false;
}

function federationTarget(msg: Message) {
  if (msg.reply_to_message?.from) return msg.reply_to_message.from;
  const entity = msg.entities?.find((e) => e.type === "text_mention");
  return entity && "user" in entity ? entity.user : null;
}
composer.command("newfed", async (ctx: Context) => {
  const msg = ctx.message as Message;
  if (!msg || !(await requirePrivate(ctx))) return;
  const parts = msg.text?.split(/\s+/) || [];
  if (parts.length < 2) {
    await ctx.reply("Name your alliance: <code>/newfed &lt;name&gt;</code>");
    return;
  }

  const fedId = randomUUID().slice(0, 8);
  const name = parts.slice(1).join(" ");
  await createFederation(fedId, name, msg.from!.id);
  await ctx.reply(pick(FED_CREATE_TEXTS, { name: escapeHtml(name), fed_id: fedId }));
});

composer.command("joinfed", async (ctx: Context) => {
  const msg = ctx.message as Message;
  if (!msg || !(await requireGroup(ctx))) return;
  const parts = msg.text?.split(/\s+/) || [];
  if (parts.length < 2) {
    await ctx.reply("Provide the federation ID: <code>/joinfed &lt;id&gt;</code>");
    return;
  }

  const fedId = parts[1];
  const fed = await getFederation(fedId);
  if (!fed) {
    await ctx.reply("No alliance bears that mark.");
    return;
  }

  const existing = await getChatFederation(msg.chat.id);
  if (existing) {
    await ctx.reply("This camp already swears to an alliance.");
    return;
  }

  await setChatFederation(msg.chat.id, fedId, msg.chat.title);
  await ctx.reply(`This camp now walks under <b>${escapeHtml(fed.name as string)}</b>.`);
});

composer.command("leavefed", async (ctx: Context) => {
  const msg = ctx.message as Message;
  if (!msg || !(await requireGroup(ctx))) return;
  const cf = await getChatFederation(msg.chat.id);
  if (cf) {
    await removeChatFederation(msg.chat.id);
  }
  await ctx.reply("This camp has left its alliance.");
});

composer.command("fban", async (ctx: Context) => {
  const msg = ctx.message as Message;
  if (!msg || !(await requireGroup(ctx))) return;
  const target = federationTarget(msg);
  if (!target) {
    await ctx.reply("Reply to someone to ban them across the alliance.");
    return;
  }

  const parts = msg.text?.split(/\s+/) || [];
  const reason = parts.slice(2).join(" ") || "No reason";

  const cf = await getChatFederation(msg.chat.id);
  if (!cf) {
    await ctx.reply("This camp pledges no alliance.");
    return;
  }

  const bans = await getFedBans(cf.fed_id as string);
  if (bans.some((b) => b.user_id === target.id)) {
    await ctx.reply("That one is already hunted across the alliance.");
    return;
  }

  await addFedBan(cf.fed_id as string, target.id, {
    first_name: target.first_name,
    last_name: target.last_name,
    username: target.username,
    reason,
  });
  await ctx.reply(
    pick(FED_BAN_TEXTS, {
      user: escapeHtml(target.first_name),
      reason: escapeHtml(reason),
    }),
  );
});

composer.command("unfban", async (ctx: Context) => {
  const msg = ctx.message as Message;
  if (!msg || !(await requireGroup(ctx))) return;
  const target = federationTarget(msg);
  if (!target) {
    await ctx.reply("Reply to someone to unban them.");
    return;
  }

  const cf = await getChatFederation(msg.chat.id);
  if (!cf) {
    await ctx.reply("This camp pledges no alliance.");
    return;
  }

  await removeFedBan(cf.fed_id as string, target.id);
  await ctx.reply(pick(FED_UNBAN_TEXTS, { user: escapeHtml(target.first_name) }));
});

composer.command("fbanlist", async (ctx: Context) => {
  const msg = ctx.message as Message;
  if (!msg || !(await requireGroup(ctx))) return;
  const cf = await getChatFederation(msg.chat.id);
  if (!cf) {
    await ctx.reply("This camp belongs to no alliance.");
    return;
  }

  const bans = await getFedBans(cf.fed_id as string);
  if (bans.length > 0) {
    const lines = [`<b>${bans.length} hunted across the alliance:</b>`];
    for (const b of bans.slice(0, 20)) {
      const name = (b.first_name as string) || String(b.user_id);
      lines.push(
        `• ${name} — <i>${(b.reason as string) || "No reason"}</i>`,
      );
    }
    await ctx.reply(lines.join("\n"));
  } else {
    await ctx.reply("No one is hunted across the alliance.");
  }
});

composer.command("feds", async (ctx: Context) => {
  const msg = ctx.message as Message;
  if (!msg) return;
  const allFeds = await listFederations({ owner: msg.from!.id });
  if (allFeds.length > 0) {
    const lines = [`<b>${allFeds.length} alliances you command:</b>`];
    for (const f of allFeds) {
      lines.push(
        `• <b>${f.name}</b> (<code>${f._id}</code>)`,
      );
    }
    await ctx.reply(lines.join("\n"));
  } else {
    await ctx.reply("You command no alliances.");
  }
});

composer.command("chatfed", async (ctx: Context) => {
  const msg = ctx.message as Message;
  if (!msg || !(await requireGroup(ctx))) return;
  const cf = await getChatFederation(msg.chat.id);
  if (cf) {
    const fed = await getFederation(cf.fed_id as string);
    if (fed) {
      await ctx.reply(
        `This camp walks under <b>${fed.name}</b> (<code>${fed._id}</code>).`,
      );
      return;
    }
  }
  await ctx.reply("This camp belongs to no alliance.");
});

composer.command("renamefed", async (ctx: Context) => {
  const msg = ctx.message as Message;
  if (!msg || !(await requireGroup(ctx))) return;
  const parts = msg.text?.split(/\s+/) || [];
  if (parts.length < 2) {
    await ctx.reply("Provide a new name: <code>/renamefed &lt;name&gt;</code>");
    return;
  }

  const cf = await getChatFederation(msg.chat.id);
  if (cf) {
    const fed = await getFederation(cf.fed_id as string);
    if (fed && fed.owner === msg.from!.id) {
      await upsert("federations", { _id: fed._id }, { name: parts.slice(1).join(" ") });
      await ctx.reply(`Alliance renamed to <b>${parts.slice(1).join(" ")}</b>.`);
      return;
    }
  }

  await ctx.reply("You do not own this alliance.");
});

composer.command("setfrules", async (ctx: Context) => {
  const msg = ctx.message as Message;
  if (!msg || !(await requireGroup(ctx))) return;
  const parts = msg.text?.split(/\s+/) || [];
  if (parts.length < 2) {
    await ctx.reply("Usage: <code>/setfrules &lt;rules&gt;</code>");
    return;
  }

  const cf = await getChatFederation(msg.chat.id);
  if (cf) {
    const fed = await getFederation(cf.fed_id as string);
    if (fed && fed.owner === msg.from!.id) {
      await upsert("federations", { _id: fed._id }, { rules: parts.slice(1).join(" ") });
      await ctx.reply("Alliance laws have been written.");
      return;
    }
  }

  await ctx.reply("You do not own this alliance.");
});

composer.command("fpromote", async (ctx: Context) => {
  const msg = ctx.message as Message;
  if (!msg || !(await requireGroup(ctx))) return;
  const target = federationTarget(msg);
  if (!target) {
    await ctx.reply("Reply to someone to promote within the alliance.");
    return;
  }

  const cf = await getChatFederation(msg.chat.id);
  if (cf) {
    const fed = await getFederation(cf.fed_id as string);
    if (fed && fed.owner === msg.from!.id) {
      const users: Record<string, string> = typeof fed.users === "string"
        ? JSON.parse(fed.users as string)
        : (fed.users as Record<string, string>) || {};
      users[String(target.id)] = "admin";
      await upsert("federations", { _id: fed._id }, { users: JSON.stringify(users) });
      await ctx.reply(`<b>${target.first_name}</b> rises within the alliance.`);
      return;
    }
  }

  await ctx.reply("You cannot do that.");
});

composer.command("fdemote", async (ctx: Context) => {
  const msg = ctx.message as Message;
  if (!msg || !(await requireGroup(ctx))) return;
  const target = federationTarget(msg);
  if (!target) {
    await ctx.reply("Reply to someone to demote.");
    return;
  }

  const cf = await getChatFederation(msg.chat.id);
  if (cf) {
    const fed = await getFederation(cf.fed_id as string);
    if (fed && fed.owner === msg.from!.id) {
      const users: Record<string, string> = typeof fed.users === "string"
        ? JSON.parse(fed.users as string)
        : (fed.users as Record<string, string>) || {};
      if (String(target.id) in users) {
        users[String(target.id)] = "member";
        await upsert("federations", { _id: fed._id }, { users: JSON.stringify(users) });
      }
      await ctx.reply(`<b>${target.first_name}</b> steps down within the alliance.`);
      return;
    }
  }

  await ctx.reply("You cannot do that.");
});
