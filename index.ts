import { bot, dp, onShutdown } from "./orion/bot.js";
import { config } from "./orion/config.js";
import { registerHandlers } from "./orion/handlers/router.js";
import { rateLimitMiddleware } from "./orion/middlewares/rate_limit.js";
import { loggingMiddleware } from "./orion/middlewares/logging.js";
import { loadRoles, OWNER_IDS } from "./orion/utils/permissions.js";
import { initDb } from "./orion/database/engine.js";
import { ERROR_TEXTS, pick } from "./orion/utils/texts.js";

async function main(): Promise<void> {
  await initDb();

  OWNER_IDS.clear();
  for (const id of config.ownerIds) {
    OWNER_IDS.add(id);
  }
  await loadRoles();

  dp.use(rateLimitMiddleware());
  dp.use(loggingMiddleware);

  await registerHandlers(dp);
  bot.use(dp);

  bot.catch((err) => {
    console.error("Exception occurred:", err.error);
    try {
      err.ctx.reply(pick(ERROR_TEXTS));
    } catch {
      // ignore
    }
  });

  console.log("Orion rises — the hunt begins.");
  bot.start({
    allowed_updates: [
      "message",
      "callback_query",
      "inline_query",
      "chat_member",
      "my_chat_member",
    ],
    drop_pending_updates: config.dropPendingUpdates,
  });
}

process.once("SIGINT", async () => {
  await onShutdown();
  process.exit(0);
});
process.once("SIGTERM", async () => {
  await onShutdown();
  process.exit(0);
});

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
