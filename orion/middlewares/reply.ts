import type { Context } from "grammy";

export async function replyMiddleware(ctx: Context, next: () => Promise<void>): Promise<void> {
  const originalReply = ctx.reply.bind(ctx);
  ctx.reply = ((text: string, other?: Record<string, unknown>) => {
    const msg = ctx.msg;
    const hasReply = other && ("reply_to_message_id" in other || "reply_parameters" in other);
    return originalReply(text, {
      ...other,
      ...(hasReply ? {} : { reply_to_message_id: msg?.message_id }),
    } as any);
  }) as typeof ctx.reply;
  await next();
}
