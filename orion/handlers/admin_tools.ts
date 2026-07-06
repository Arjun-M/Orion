import { readFile } from "node:fs/promises";
import { execSync } from "node:child_process";
import { Composer, InputFile } from "grammy";
import type { Context } from "grammy";
import type { Message } from "grammy/types";
import { escapeHtml } from "../utils/helpers.js";
import { DEV_USERS, OWNER_IDS } from "../utils/permissions.js";
import { getAll, getGban, gbanUser, ungbanUser } from "../database/models.js";
import { GBAN_TEXTS, NOT_DEV_TEXTS, UNGBAN_TEXTS, pick } from "../utils/texts.js";

export const composer = new Composer<Context>();

export const modName = "Dev";


function isDev(ctx: Context): boolean {
  const userId = ctx.from?.id;
  return !!userId && (OWNER_IDS.has(userId) || DEV_USERS.has(userId));
}

async function requireDev(ctx: Context): Promise<boolean> {
  if (isDev(ctx)) return true;
  await ctx.reply(pick(NOT_DEV_TEXTS));
  return false;
}

export const helpText =
  "The stars themselves obey the master hunter. These commands are reserved for the highest rank.\n\n" +
  "<b>Commands:</b>\n" +
  "• <code>/logs</code> — Read the hunt's record\n" +
  "• <code>/shell &lt;cmd&gt;</code> — Speak to the void (shell)\n" +
  "• <code>/eval &lt;code&gt;</code> — Test the fates (JavaScript)\n" +
  "• <code>/chatlist</code> — See all tracked camps\n" +
  "• <code>/userlist</code> — See all tracked hunters\n" +
  "• <code>/leavechat &lt;id&gt;</code> — Depart from a camp\n" +
  "• <code>/update</code> — Pull new stars from the sky\n" +
  "• <code>/dbcleanup</code> — Cleanse the database\n" +
  "• <code>/speedtest</code> — Test the winds\n" +
  "• <code>/gban &lt;user&gt; [reason]</code> — Hunt a soul across all lands\n" +
  "• <code>/ungban &lt;user&gt;</code> — Stop the global hunt";

composer.command("logs", async (ctx: Context) => {
  const msg = ctx.message as Message;
  if (!msg || !(await requireDev(ctx))) return;
  try {
    const data = await readFile("orion.log");
    await ctx.api.sendDocument(msg.chat.id, new InputFile(data, "orion.log"));
  } catch {
    await ctx.reply("No log file found. The hunt leaves few tracks.");
  }
});

composer.command(["shell", "bash", "sh"], async (ctx: Context) => {
  const msg = ctx.message as Message;
  if (!msg || !(await requireDev(ctx))) return;
  const parts = msg.text?.split(/\s+/) || [];
  if (parts.length < 2) {
    await ctx.reply("What command shall I speak to the void?");
    return;
  }

  const cmd = parts.slice(1).join(" ");
  try {
    const output = execSync(cmd, { timeout: 30000, encoding: "utf-8" });
    let result = output || "No output.";
    if (result.length > 4000) {
      result = result.slice(0, 4000) + "\n... [truncated]";
    }
    await ctx.reply(`<code>${escapeHtml(result)}</code>`);
  } catch (e: unknown) {
    const err = e as Error;
    await ctx.reply(`Error: <code>${escapeHtml(err.message)}</code>`);
  }
});

composer.command("eval", async (ctx: Context) => {
  const msg = ctx.message as Message;
  if (!msg || !(await requireDev(ctx))) return;
  const parts = msg.text?.split(/\s+/) || [];
  if (parts.length < 2) {
    await ctx.reply("What code should I test against the fates?");
    return;
  }

  const code = parts.slice(1).join(" ");
  try {
    const result = eval(code);
    let output = String(result ?? "Executed (no output).");
    if (output.length > 4000) {
      output = output.slice(0, 4000) + "\n... [truncated]";
    }
    await ctx.reply(`<code>${escapeHtml(output)}</code>`);
  } catch (e: unknown) {
    const err = e as Error;
    await ctx.reply(`Error: <code>${escapeHtml(err.message)}</code>`);
  }
});

composer.command("chatlist", async (ctx: Context) => {
  const msg = ctx.message as Message;
  if (!msg || !(await requireDev(ctx))) return;
  const chats = await getAll("chats");
  if (chats.length > 0) {
    const lines = [`<b>${chats.length} camps tracked:</b>`];
    for (const c of chats.slice(0, 30)) {
      lines.push(
        `• ${escapeHtml((c.title as string) || "?")} (<code>${c._id}</code>)`,
      );
    }
    await ctx.reply(lines.join("\n"));
  } else {
    await ctx.reply("No camps are tracked.");
  }
});

composer.command("userlist", async (ctx: Context) => {
  const msg = ctx.message as Message;
  if (!msg || !(await requireDev(ctx))) return;
  const users = await getAll("users");
  await ctx.reply(`<b>${users.length}</b> hunters are known to me.`);
});

composer.command("leavechat", async (ctx: Context) => {
  const msg = ctx.message as Message;
  if (!msg || !(await requireDev(ctx))) return;
  const parts = msg.text?.split(/\s+/) || [];
  if (parts.length < 2) {
    await ctx.reply("Usage: <code>/leavechat &lt;chat_id&gt;</code>");
    return;
  }

  try {
    const chatId = parseInt(parts[1], 10);
    await ctx.api.leaveChat(chatId);
    await ctx.reply(`Left camp <code>${chatId}</code>.`);
  } catch (e: unknown) {
    const err = e as Error;
    await ctx.reply(`Failed: <code>${escapeHtml(err.message)}</code>`);
  }
});

composer.command("update", async (ctx: Context) => {
  const msg = ctx.message as Message;
  if (!msg || !(await requireDev(ctx))) return;
  const sent = await ctx.reply("Pulling new stars from the sky...");
  try {
    const result = execSync("git pull", {
      timeout: 30000,
      encoding: "utf-8",
    });
    await ctx.api.editMessageText(
      msg.chat.id,
      sent.message_id,
      `Update complete:\n<code>${result.slice(0, 2000)}</code>`,
    );
  } catch (e: unknown) {
    const err = e as Error;
    await ctx.api.editMessageText(
      msg.chat.id,
      sent.message_id,
      `Update failed: <code>${escapeHtml(err.message)}</code>`,
    );
  }
});

composer.command("dbcleanup", async (ctx: Context) => {
  const msg = ctx.message as Message;
  if (!msg || !(await requireDev(ctx))) return;
  await ctx.reply("MongoDB needs no cleansing. The stars keep their own order.");
});

composer.command("speedtest", async (ctx: Context) => {
  const msg = ctx.message as Message;
  if (!msg || !(await requireDev(ctx))) return;
  const sent = await ctx.reply("Testing the winds...");
  try {
    const result = execSync(
      "python3 -c \"import speedtest; s=speedtest.Speedtest(); s.get_best_server(); print(f'{s.download()/1000000:.2f} {s.upload()/1000000:.2f}')\"",
      { timeout: 60000, encoding: "utf-8" },
    );
    const [down, up] = result.trim().split(" ");
    await ctx.api.editMessageText(
      msg.chat.id,
      sent.message_id,
      `<b>Speed Test:</b>\n⬇ <b>${down}</b> Mbps\n⬆ <b>${up}</b> Mbps`,
    );
  } catch {
    await ctx.api.editMessageText(
      msg.chat.id,
      sent.message_id,
      "Speed test failed. speedtest-cli may not be available.",
    );
  }
});

composer.command("gban", async (ctx: Context) => {
  const msg = ctx.message as Message;
  if (!msg || !(await requireDev(ctx))) return;
  const target = msg.reply_to_message?.from;
  if (!target) {
    await ctx.reply("Reply to someone to mark them across all lands.");
    return;
  }

  const parts = msg.text?.split(/\s+/) || [];
  const reason = parts.slice(2).join(" ") || "Global hunt";

  const existing = await getGban(target.id);
  if (!existing) {
    await gbanUser(target.id, target.first_name, reason);
  }

  await ctx.reply(pick(GBAN_TEXTS, { user: target.first_name, reason }));
});

composer.command("ungban", async (ctx: Context) => {
  const msg = ctx.message as Message;
  if (!msg || !(await requireDev(ctx))) return;
  const target = msg.reply_to_message?.from;
  if (!target) {
    await ctx.reply("Reply to someone to lift their global mark.");
    return;
  }

  const existing = await getGban(target.id);
  if (existing) {
    await ungbanUser(target.id);
  }

  await ctx.reply(pick(UNGBAN_TEXTS, { user: target.first_name }));
});
