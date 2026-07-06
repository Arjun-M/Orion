import "dotenv/config";

export interface Config {
  token: string;
  mongoUri: string;
  cachePath: string;
  ownerIds: number[];
  webhook: boolean;
  webhookUrl: string | null;
  webhookPort: number;
  webhookPath: string | null;
  certPath: string | null;
  dropPendingUpdates: boolean;
  logChannel: number | null;
  gbanLogChannel: number | null;
  banSticker: string;
  deleteCommands: boolean;
  strictGban: boolean;
  allowExcl: boolean;
  infopic: boolean;
  lastfmApiKey: string | null;
  cfApiKey: string | null;
  debug: boolean;
  botUsername: string;
  supportChat: string;
  channel: string;
  githubRepo: string;
}

export const config: Config = {
  token: process.env.ORION_TOKEN || "",
  mongoUri: process.env.ORION_MONGO_URI || "mongodb://localhost:27017/orion",
  cachePath: process.env.ORION_CACHE_PATH || "orion_cache.db",
  ownerIds: (process.env.ORION_OWNER_IDS || "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s)
    .map(Number),
  webhook: process.env.ORION_WEBHOOK?.toLowerCase() === "true",
  webhookUrl: process.env.ORION_WEBHOOK_URL || null,
  webhookPort: parseInt(process.env.ORION_WEBHOOK_PORT || "8080", 10),
  webhookPath: process.env.ORION_WEBHOOK_PATH || null,
  certPath: process.env.ORION_CERT_PATH || null,
  dropPendingUpdates:
    (process.env.ORION_DROP_UPDATES || "true").toLowerCase() === "true",
  logChannel: process.env.ORION_LOG_CHANNEL
    ? parseInt(process.env.ORION_LOG_CHANNEL, 10)
    : null,
  gbanLogChannel: process.env.ORION_GBAN_LOG_CHANNEL
    ? parseInt(process.env.ORION_GBAN_LOG_CHANNEL, 10)
    : null,
  banSticker: process.env.ORION_BAN_STICKER || "",
  deleteCommands:
    (process.env.ORION_DEL_CMDS || "true").toLowerCase() === "true",
  strictGban:
    (process.env.ORION_STRICT_GBAN || "true").toLowerCase() === "true",
  allowExcl:
    (process.env.ORION_ALLOW_EXCL || "true").toLowerCase() === "true",
  infopic: (process.env.ORION_INFOPIC || "true").toLowerCase() === "true",
  lastfmApiKey: process.env.ORION_LASTFM_API_KEY || null,
  cfApiKey: process.env.ORION_CF_API_KEY || null,
  debug: process.env.ORION_DEBUG?.toLowerCase() === "true",
  botUsername: process.env.ORION_USERNAME || "OrionGroupBot",
  supportChat: process.env.ORION_SUPPORT_CHAT || "",
  channel: process.env.ORION_CHANNEL || "",
  githubRepo: "Arjun-M/Orion",
};
