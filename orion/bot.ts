import { Bot, Composer } from "grammy";
import { config } from "./config.js";
import { closeDb } from "./database/engine.js";

export const bot = new Bot(config.token);
export const dp = new Composer();

// Set HTML as default parse mode for all messages
bot.api.config.use((prev, method, payload) => {
  if (
    payload &&
    typeof payload === "object" &&
    [
      "sendMessage",
      "editMessageText",
      "sendPhoto",
      "sendVideo",
      "sendAudio",
      "sendDocument",
      "sendVoice",
      "sendAnimation",
      "sendVenue",
      "sendGame",
      "sendPoll",
    ].includes(method)
  ) {
    (payload as Record<string, unknown>).parse_mode = "HTML";
  }
  return prev(method, payload);
});

export async function onShutdown(): Promise<void> {
  await closeDb();
  console.log("Orion sets — the hunt rests.");
}
