import { Composer } from "grammy";
import type { Context, NextFunction } from "grammy";
import type { Message } from "grammy/types";
import { AFK_TEXTS, BACK_TEXTS, pick } from "../utils/texts.js";
import { formatAfkDuration, escapeHtml } from "../utils/helpers.js";
import { getAfk, setAfk, unsetAfk, getAll } from "../database/models.js";

export const composer = new Composer<Context>();

export const modName = "AFK";

export const helpText =
  "Even a hunter must rest. When you step away, let the camp know.\n\n" +
  "<b>Commands:</b>\n" +
  "• <code>/afk [reason]</code> — I am away. The hunt continues without me.\n\n" +
  "When someone mentions you, they will be told you are away. " +
  "Send any message upon return to announce your presence.";

composer.command("afk", async (ctx: Context) => {
  const msg = ctx.message as Message;
  if (!msg) return;
  const parts = msg.text?.split(/\s+/) || [];
  const reason =
    parts.length > 1
      ? parts.slice(1).join(" ")
      : "The hunt needs me elsewhere.";
  await setAfk(msg.from!.id, reason);
  await ctx.reply(
    pick(AFK_TEXTS, {
      user: escapeHtml(msg.from!.first_name),
      reason: escapeHtml(reason),
    }),
  );
});

composer.on("message:text", async (ctx: Context, next: NextFunction) => {
  const msg = ctx.message as Message;
  if (!msg || !msg.text) {
    await next();
    return;
  }
  if (msg.text.startsWith("/")) {
    await next();
    return;
  }

  const uid = msg.from!.id;
  const afk = await getAfk(uid);
  if (afk && afk.is_afk) {
    const duration = afk.since
      ? formatAfkDuration(new Date(afk.since as string))
      : "unknown";
    await unsetAfk(uid);
    await ctx.reply(
      pick(BACK_TEXTS, {
        user: escapeHtml(msg.from!.first_name),
        duration,
      }),
    );
  }

  const entities = msg.entities || [];
  for (const entity of entities) {
    if (entity.type === "mention") {
      const username = msg.text.slice(
        entity.offset,
        entity.offset + entity.length,
      ).replace("@", "");
      const users = await getAll("users", {
        username,
      });
      if (users.length > 0) {
        const afk = await getAfk(users[0]._id as number);
        if (afk && afk.is_afk) {
          await ctx.reply(
            `<b>@${escapeHtml(username)}</b> is away. <i>${escapeHtml((afk.reason as string) || "No reason")}</i>`,
          );
        }
      }
    } else if (entity.type === "text_mention") {
      const uid = entity.user.id;
      const afk = await getAfk(uid);
      if (afk && afk.is_afk) {
        await ctx.reply(
          `<b>${escapeHtml(entity.user.first_name)}</b> is away. <i>${escapeHtml((afk.reason as string) || "No reason")}</i>`,
        );
      }
    }
  }
  await next();
});
