import { rateLimitCheck } from "../database/cache.js";
import type { Context, NextFunction } from "grammy";

export function rateLimitMiddleware(
  messages: number = 20,
  window: number = 60,
) {
  return async (ctx: Context, next: NextFunction): Promise<void> => {
    const user = ctx.from;
    if (!user) {
      await next();
      return;
    }
    if (!rateLimitCheck(user.id, messages, window)) {
      return;
    }
    await next();
  };
}
