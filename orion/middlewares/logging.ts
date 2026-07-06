import type { Context, NextFunction } from "grammy";
import type { Message } from "grammy/types";

export async function loggingMiddleware(
  ctx: Context,
  next: NextFunction,
): Promise<void> {
  const msg = ctx.message as Message | undefined;
  if (msg) {
    const user = msg.from;
    const chat = msg.chat;
    const text = msg.text || msg.caption || "[media]";
    console.log(
      `[${chat.type.toUpperCase()}] ${user?.first_name ?? "?"} (${user?.id ?? 0}) in ${chat.title || chat.username || "PM"} (${chat.id}): ${text.slice(0, 200)}`,
    );
  }
  await next();
}
