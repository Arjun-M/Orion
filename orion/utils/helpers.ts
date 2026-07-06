import { InlineKeyboard } from "grammy";
import type { Context } from "grammy";
import {
  GROUP_ONLY_TEXTS,
  pick,
} from "./texts.js";

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function requireGroup(ctx: Context): Promise<boolean> {
  const msg = ctx.message;
  if (!msg || msg.chat.type === "private") {
    await ctx.reply(pick(GROUP_ONLY_TEXTS));
    return false;
  }
  return true;
}

export function splitMessage(text: string, maxLen: number = 4096): string[] {
  const parts: string[] = [];
  while (text.length > maxLen) {
    let cut = text.lastIndexOf("\n", maxLen);
    if (cut < 0) cut = maxLen;
    parts.push(text.slice(0, cut));
    text = text.slice(cut);
  }
  parts.push(text);
  return parts;
}

export function paginateModules(
  moduleDict: Record<string, { name: string; help: string }>,
  prefix: string,
  chatId?: number,
): ReturnType<typeof InlineKeyboard.from> {
  const modules = Object.entries(moduleDict).sort((a, b) =>
    a[1].name.localeCompare(b[1].name),
  );
  if (modules.length === 0) {
    return InlineKeyboard.from([]);
  }

  const rows: { text: string; callback_data: string }[][] = [];
  let row: { text: string; callback_data: string }[] = [];
  for (const [key, mod] of modules) {
    const cb = chatId
      ? `${prefix}_module(${key},${chatId})`
      : `${prefix}_module(${key})`;
    row.push({ text: mod.name, callback_data: cb });
    if (row.length === 3) {
      rows.push(row);
      row = [];
    }
  }
  if (row.length > 0) rows.push(row);
  rows.push([{ text: "« Back", callback_data: "start_back" }]);
  return InlineKeyboard.from(rows);
}

export function extractTime(timeStr: string): number | null {
  const units: Record<string, number> = {
    m: 60,
    h: 3600,
    d: 86400,
    w: 604800,
  };
  const match = timeStr.toLowerCase().match(/^(\d+)([mhdw])$/);
  if (!match) return null;
  const val = parseInt(match[1], 10);
  const unit = match[2];
  return val * units[unit];
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

export function formatAfkDuration(start: Date): string {
  const delta = Date.now() - start.getTime();
  const total = Math.floor(delta / 1000);
  return formatDuration(total);
}

export function isCommand(
  text: string | undefined,
  botUsername: string,
  allowExcl: boolean = true,
): string | null {
  const prefixes = ["/"];
  if (allowExcl) prefixes.push("!");
  if (!text) return null;
  for (const p of prefixes) {
    if (text.startsWith(p)) {
      const parts = text.slice(1).split(/\s+/);
      const cmd = parts[0].split("@")[0].toLowerCase();
      return cmd;
    }
  }
  return null;
}

export function parseButtonMarkdown(
  text: string,
): [string, Array<[string, string, boolean]>] {
  const buttons: Array<[string, string, boolean]> = [];
  const pattern = /\[([^\]]+)\]\(buttonurl:\/\/([^:]+)(?::same)?\)/g;
  let match;
  while ((match = pattern.exec(text)) !== null) {
    let url = match[2];
    const same = url.includes(":same");
    url = url.replace(":same", "");
    buttons.push([match[1], url, same]);
  }
  const clean = text.replace(pattern, "").trim();
  return [clean, buttons];
}

export function buildKeyboard(
  buttons: Array<[string, string, boolean]>,
): ReturnType<typeof InlineKeyboard.from> {
  const rows: { text: string; url: string }[][] = [];
  let row: { text: string; url: string }[] = [];
  for (const [name, url, sameLine] of buttons) {
    row.push({ text: name, url });
    if (!sameLine) {
      rows.push(row);
      row = [];
    }
  }
  if (row.length > 0) rows.push(row);
  return InlineKeyboard.from(rows);
}
