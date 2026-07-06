import type { Context } from "grammy";
import { ERROR_TEXTS, pick } from "../utils/texts.js";

export async function errorHandler(ctx: Context, next: () => Promise<void>): Promise<void> {
  try {
    await next();
  } catch (err) {
    const msg = String(err);
    if (msg.includes("not enough rights")) {
      try {
        await ctx.reply("Please promote me to admin with the required permission to act.");
      } catch {
        // ignore
      }
      return;
    }
    console.error("Exception occurred:", err);
    try {
      await ctx.reply(pick(ERROR_TEXTS));
    } catch {
      // ignore
    }
  }
}
