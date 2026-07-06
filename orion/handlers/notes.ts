import { Composer } from "grammy";
import type { Context } from "grammy";
import type { Message } from "grammy/types";
import { NOTE_SAVED_TEXTS, NOTE_DELETED_TEXTS, pick } from "../utils/texts.js";
import {
  parseButtonMarkdown,
  buildKeyboard,
  requireGroup,
  escapeHtml,
} from "../utils/helpers.js";
import {
  getNote,
  saveNote,
  listNotes,
  deleteNote,
} from "../database/models.js";
import { cacheDelete } from "../database/cache.js";

export const composer = new Composer<Context>();

export const modName = "Notes";

export const helpText =
  "Scrolls are messages I remember for you. Save anything — text, photos, stickers, documents — and retrieve them on command.\n\n" +
  "<b>Commands:</b>\n" +
  "• <code>/save &lt;name&gt;</code> — Record a scroll (reply to media or type text)\n" +
  "• <code>/get &lt;name&gt;</code> — Read a scroll\n" +
  "• <code>/notes</code> or <code>/saved</code> — List all scrolls in this camp\n" +
  "• <code>/clear &lt;name&gt;</code> — Shred a scroll\n\n" +
  "Notes support <b>Markdown formatting</b>, <b>buttons</b>, and <b>welcome variables</b>. See <code>/markdownhelp</code>.";

composer.command("save", async (ctx: Context) => {
  const msg = ctx.message as Message;
    if (!msg || !(await requireGroup(ctx))) return;
  const text = msg.text || "";
  const parts = text.split(/\s+/);
  if (parts.length < 2) {
    await ctx.reply("Name your scroll: <code>/save &lt;name&gt;</code>");
    return;
  }
  const name = parts.slice(1).join(" ").trim().toLowerCase();

  let content: string | null = null;
  let contentType = "text";
  let fileId: string | null = null;

  if (msg.reply_to_message) {
    const r = msg.reply_to_message;
    if (r.text) content = r.text;
    else if (r.caption) content = r.caption;
    if (r.sticker) {
      contentType = "sticker";
      fileId = r.sticker.file_id;
    } else if (r.photo) {
      contentType = "photo";
      fileId = r.photo[r.photo.length - 1].file_id;
    } else if (r.document) {
      contentType = "document";
      fileId = r.document.file_id;
    } else if (r.audio) {
      contentType = "audio";
      fileId = r.audio.file_id;
    } else if (r.voice) {
      contentType = "voice";
      fileId = r.voice.file_id;
    } else if (r.video) {
      contentType = "video";
      fileId = r.video.file_id;
    }
  } else if (parts.length > 2) {
    content = parts.slice(2).join(" ");
  }

  if (!content && !fileId) {
    await ctx.reply("What should I record? Reply to a message or include text.");
    return;
  }

  await saveNote(msg.chat.id, name, {
    content,
    content_type: contentType,
    file_id: fileId,
  });
  cacheDelete(`note:${msg.chat.id}:${name}`);
  await ctx.reply(pick(NOTE_SAVED_TEXTS, { name: escapeHtml(name) }));
});

composer.command("get", async (ctx: Context) => {
  const msg = ctx.message as Message;
    if (!msg || !(await requireGroup(ctx))) return;
  const text = msg.text || "";
  const parts = text.split(/\s+/);
  if (parts.length < 2) {
    await ctx.reply("Which scroll shall I read? <code>/get &lt;name&gt;</code>");
    return;
  }
  const name = parts.slice(1).join(" ").trim().toLowerCase();

  const note = await getNote(msg.chat.id, name);
  if (!note) {
    await ctx.reply(`No scroll named <b>'${name}'</b> exists in this camp.`);
    return;
  }

  const user = msg.from!;
  const kw: Record<string, string | number> = {
    first: user.first_name || "",
    last: user.last_name || "",
    fullname: `${user.first_name || ""} ${user.last_name || ""}`.trim(),
    username: user.username ? `@${user.username}` : "",
    mention: `<a href="tg://user?id=${user.id}">${escapeHtml(user.first_name || "User")}</a>`,
    id: user.id,
    chatname: msg.chat.title || "this camp",
  };
  let content = (note.content as string) || "";
  try {
    content = content.replace(/\{(\w+)\}/g, (_, key) => String(kw[key] ?? `{${key}}`));
  } catch {
    // ignore
  }
  const [clean] = parseButtonMarkdown(content);
  const ct = (note.content_type as string) || "text";
  const fid = note.file_id as string | undefined;

  if (ct === "text") {
    await ctx.reply(escapeHtml(clean));
  } else if (ct === "sticker" && fid) {
    await ctx.api.sendSticker(msg.chat.id, fid);
  } else if (ct === "photo" && fid) {
    await ctx.api.sendPhoto(msg.chat.id, fid, { caption: escapeHtml(clean) });
  } else if (ct === "document" && fid) {
    await ctx.api.sendDocument(msg.chat.id, fid, { caption: escapeHtml(clean) });
  } else if (ct === "audio" && fid) {
    await ctx.api.sendAudio(msg.chat.id, fid, { caption: escapeHtml(clean) });
  } else if (ct === "voice" && fid) {
    await ctx.api.sendVoice(msg.chat.id, fid, { caption: escapeHtml(clean) });
  } else if (ct === "video" && fid) {
    await ctx.api.sendVideo(msg.chat.id, fid, { caption: escapeHtml(clean) });
  }
});

composer.command(["notes", "saved"], async (ctx: Context) => {
  const msg = ctx.message as Message;
    if (!msg || !(await requireGroup(ctx))) return;
  const notes = await listNotes(msg.chat.id);
  if (notes.length > 0) {
    const lines = [`<b>${notes.length} scrolls in this camp:</b>`];
    for (const n of notes) {
      lines.push(`• <code>/${escapeHtml(n.name as string)}</code>`);
    }
    await ctx.reply(lines.join("\n"));
  } else {
    await ctx.reply("No scrolls are kept in this camp.");
  }
});

composer.command("clear", async (ctx: Context) => {
  const msg = ctx.message as Message;
    if (!msg || !(await requireGroup(ctx))) return;
  const text = msg.text || "";
  const parts = text.split(/\s+/);
  if (parts.length < 2) {
    await ctx.reply("Which scroll shall I burn? <code>/clear &lt;name&gt;</code>");
    return;
  }
  const name = parts.slice(1).join(" ").trim().toLowerCase();

  const note = await getNote(msg.chat.id, name);
  if (note) {
    await deleteNote(msg.chat.id, name);
    cacheDelete(`note:${msg.chat.id}:${name}`);
    await ctx.reply(pick(NOTE_DELETED_TEXTS, { name: escapeHtml(name) }));
  } else {
    await ctx.reply(`No scroll named <b>'${escapeHtml(name)}'</b>.`);
  }
});
