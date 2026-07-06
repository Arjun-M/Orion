import { InlineKeyboard } from "grammy";
import { config } from "../config.js";

export function startKeyboard(): ReturnType<typeof InlineKeyboard.from> {
  return InlineKeyboard.from([
    [
      { text: "About Me", callback_data: "about_me" },
      { text: "Help", callback_data: "help_back" },
    ],
    [
      {
        text: "Add to Group",
        url: `https://t.me/${config.botUsername}?startgroup=true`,
      },
      { text: "Updates", url: `https://t.me/${config.channel}` },
    ],
    [
      { text: "Source", url: `https://github.com/${config.githubRepo}` },
    ],
  ]);
}

export function aboutKeyboard(): ReturnType<typeof InlineKeyboard.from> {
  return InlineKeyboard.from([
    [
      { text: "« Back", callback_data: "about_back" },
    ],
  ]);
}

export function groupHelpKeyboard(): ReturnType<typeof InlineKeyboard.from> {
  return InlineKeyboard.from([
    [
      {
        text: "Help",
        url: `https://t.me/${config.botUsername}?start=help`,
      },
    ],
  ]);
}

export function helpBackKeyboard(): ReturnType<typeof InlineKeyboard.from> {
  return InlineKeyboard.from([
    [
      { text: "« Back", callback_data: "help_back" },
      { text: "Support", url: `https://t.me/${config.supportChat}` },
    ],
  ]);
}

export function confirmationKeyboard(
  action: string,
  data: string,
): ReturnType<typeof InlineKeyboard.from> {
  return InlineKeyboard.from([
    [
      { text: "Yes", callback_data: `confirm_${action}:${data}` },
      { text: "No", callback_data: "cancel" },
    ],
  ]);
}
