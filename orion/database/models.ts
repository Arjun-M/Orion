import { getDb } from "./engine.js";

function _ts(): Date {
  return new Date();
}

function _db() {
  const d = getDb();
  if (!d) throw new Error("Database not initialized");
  return d;
}

export async function upsert(
  collection: string,
  query: Record<string, unknown>,
  data: Record<string, unknown>,
): Promise<void> {
  await _db()
    .collection(collection)
    .replaceOne(
      query,
      { ...query, ...data, updated_at: _ts() },
      { upsert: true },
    );
}

async function getOne(
  collection: string,
  query: Record<string, unknown>,
): Promise<Record<string, unknown> | null> {
  return await _db().collection(collection).findOne(query);
}

export async function getAll(
  collection: string,
  query: Record<string, unknown> = {},
  sort?: Record<string, 1 | -1>,
): Promise<Record<string, unknown>[]> {
  let cursor = _db().collection(collection).find(query);
  if (sort) {
    cursor = cursor.sort(sort);
  }
  return await cursor.toArray();
}

async function count(
  collection: string,
  query: Record<string, unknown> = {},
): Promise<number> {
  return await _db().collection(collection).countDocuments(query);
}

async function deleteOne(
  collection: string,
  query: Record<string, unknown>,
): Promise<void> {
  await _db().collection(collection).deleteOne(query);
}

async function deleteMany(
  collection: string,
  query: Record<string, unknown>,
): Promise<void> {
  await _db().collection(collection).deleteMany(query);
}

// ── User ──

export async function getUser(
  userId: number,
): Promise<Record<string, unknown> | null> {
  return await getOne("users", { _id: userId });
}

export async function saveUser(
  userId: number,
  kw: {
    username?: string;
    first_name?: string;
    last_name?: string;
    is_bot?: boolean;
    language?: string;
  },
): Promise<void> {
  const doc: Record<string, unknown> = {
    _id: userId,
    username: kw.username,
    first_name: kw.first_name,
    last_name: kw.last_name,
    is_bot: kw.is_bot ?? false,
    language: kw.language ?? "en",
    joined_at: _ts(),
  };
  await upsert("users", { _id: userId }, doc);
}

// ── Chat ──

export async function getChat(
  chatId: number,
): Promise<Record<string, unknown> | null> {
  return await getOne("chats", { _id: chatId });
}

export async function saveChat(
  chatId: number,
  kw: { title?: string; username?: string; type?: string },
): Promise<void> {
  const doc: Record<string, unknown> = {
    _id: chatId,
    title: kw.title,
    username: kw.username,
    type: kw.type,
    joined_at: _ts(),
  };
  await upsert("chats", { _id: chatId }, doc);
}

// ── Member ──

export async function getMember(
  userId: number,
  chatId: number,
): Promise<Record<string, unknown> | null> {
  return await getOne("members", { user_id: userId, chat_id: chatId });
}

export async function saveMember(
  userId: number,
  chatId: number,
): Promise<void> {
  const exists = await getMember(userId, chatId);
  if (!exists) {
    await _db().collection("members").insertOne({ user_id: userId, chat_id: chatId });
  }
}

// ── GroupSettings ──

export const DEFAULT_GROUP_SETTINGS: Record<string, unknown> = {
  welcome_enabled: true,
  goodbye_enabled: true,
  welcome_message: null,
  goodbye_message: null,
  welcome_buttons: null,
  goodbye_buttons: null,
  welcome_mute: "off",
  clean_welcome: false,
  clean_service: false,
  rules: null,
  log_channel: null,
  log_joins: true,
  log_leaves: true,
  log_warns: true,
  log_actions: true,
  log_reports: true,
  reports_enabled: true,
  connection_enabled: true,
  raid_mode: false,
  raid_time: 10,
  raid_duration: 60,
  gban_enabled: true,
  warn_limit: 3,
  soft_warn: true,
  flood_limit: 10,
  flood_action: "mute",
  flood_action_value: null,
  blacklist_action: "delete",
  blacklist_action_value: null,
  sticker_blacklist_action: "delete",
  sticker_blacklist_action_value: null,
};

export async function getGroupSettings(
  chatId: number,
): Promise<Record<string, unknown>> {
  const doc = await getOne("group_settings", { _id: chatId });
  if (!doc) {
    return { ...DEFAULT_GROUP_SETTINGS, _id: chatId };
  }
  return doc;
}

export async function saveGroupSetting(
  chatId: number,
  kw: Record<string, unknown>,
): Promise<void> {
  const base = await getGroupSettings(chatId);
  await upsert("group_settings", { _id: chatId }, { ...base, ...kw });
}

// ── Note ──

export async function getNote(
  chatId: number,
  name: string,
): Promise<Record<string, unknown> | null> {
  return await getOne("notes", { chat_id: chatId, name });
}

export async function saveNote(
  chatId: number,
  name: string,
  kw: Record<string, unknown>,
): Promise<void> {
  const doc = { chat_id: chatId, name, ...kw };
  await upsert("notes", { chat_id: chatId, name }, doc);
}

export async function listNotes(chatId: number): Promise<Record<string, unknown>[]> {
  return await getAll("notes", { chat_id: chatId }, { name: 1 });
}

export async function deleteNote(chatId: number, name: string): Promise<void> {
  await deleteOne("notes", { chat_id: chatId, name });
}

// ── CustomFilter ──

export async function getFilter(
  chatId: number,
  keyword: string,
): Promise<Record<string, unknown> | null> {
  return await getOne("custom_filters", { chat_id: chatId, keyword });
}

export async function saveFilter(
  chatId: number,
  keyword: string,
  content: string,
  kw: Record<string, unknown> = {},
): Promise<void> {
  const doc = { chat_id: chatId, keyword, content, ...kw };
  await upsert("custom_filters", { chat_id: chatId, keyword }, doc);
}

export async function listFilters(
  chatId: number,
): Promise<Record<string, unknown>[]> {
  return await getAll("custom_filters", { chat_id: chatId }, { keyword: 1 });
}

export async function deleteFilter(
  chatId: number,
  keyword: string,
): Promise<void> {
  await deleteOne("custom_filters", { chat_id: chatId, keyword });
}

// ── BlacklistWord ──

export async function getBlacklistWords(
  chatId: number,
): Promise<Record<string, unknown>[]> {
  return await getAll("blacklist_words", { chat_id: chatId });
}

export async function addBlacklistWord(
  chatId: number,
  word: string,
): Promise<void> {
  const exists = await getOne("blacklist_words", {
    chat_id: chatId,
    word,
  });
  if (!exists) {
    await _db()
      .collection("blacklist_words")
      .insertOne({ chat_id: chatId, word });
  }
}

export async function removeBlacklistWord(
  chatId: number,
  word: string,
): Promise<void> {
  await deleteOne("blacklist_words", { chat_id: chatId, word });
}

// ── StickerBlacklist ──

export async function getStickerBlacklist(
  chatId: number,
): Promise<Record<string, unknown>[]> {
  return await getAll("sticker_blacklist", { chat_id: chatId });
}

export async function addStickerBlacklist(
  chatId: number,
  trigger: string,
): Promise<void> {
  const exists = await getOne("sticker_blacklist", {
    chat_id: chatId,
    trigger,
  });
  if (!exists) {
    await _db()
      .collection("sticker_blacklist")
      .insertOne({ chat_id: chatId, trigger });
  }
}

export async function removeStickerBlacklist(
  chatId: number,
  trigger: string,
): Promise<void> {
  await deleteOne("sticker_blacklist", { chat_id: chatId, trigger });
}

// ── LockSetting ──

export const LOCKABLE_FIELDS = [
  "audio", "voice", "document", "video", "contact", "photo",
  "sticker", "gif", "url", "bots", "forward", "game", "location",
  "rtl", "button", "inline", "poll", "messages", "media",
  "previews", "invite", "pin", "info", "other",
];

export async function getLocks(
  chatId: number,
): Promise<Record<string, unknown>> {
  const doc = await getOne("locks", { _id: chatId });
  if (!doc) return { _id: chatId };
  return doc;
}

export async function setLock(
  chatId: number,
  item: string,
  value: boolean,
): Promise<void> {
  await upsert("locks", { _id: chatId }, { [item]: value });
}

// ── DisabledCommand ──

export async function getDisabledCommands(
  chatId: number,
): Promise<string[]> {
  const docs = await getAll("disabled_commands", { chat_id: chatId });
  return docs.map((d) => d.command as string);
}

export async function disableCommand(
  chatId: number,
  command: string,
): Promise<void> {
  const exists = await getOne("disabled_commands", {
    chat_id: chatId,
    command,
  });
  if (!exists) {
    await _db()
      .collection("disabled_commands")
      .insertOne({ chat_id: chatId, command });
  }
}

export async function enableCommand(
  chatId: number,
  command: string,
): Promise<void> {
  await deleteOne("disabled_commands", { chat_id: chatId, command });
}

// ── ApprovedUser ──

export async function getApprovedUsers(
  chatId: number,
): Promise<Record<string, unknown>[]> {
  return await getAll("approved_users", { chat_id: chatId });
}

export async function approveUser(
  chatId: number,
  userId: number,
): Promise<void> {
  const exists = await getOne("approved_users", {
    chat_id: chatId,
    user_id: userId,
  });
  if (!exists) {
    await _db()
      .collection("approved_users")
      .insertOne({ chat_id: chatId, user_id: userId });
  }
}

export async function unapproveUser(
  chatId: number,
  userId: number,
): Promise<void> {
  await deleteOne("approved_users", { chat_id: chatId, user_id: userId });
}

// ── AntiChannel ──

export async function getAntiChannel(
  chatId: number,
): Promise<Record<string, unknown>> {
  const doc = await getOne("anti_channel", { _id: chatId });
  return doc || { _id: chatId, enabled: false };
}

export async function toggleAntiChannel(chatId: number): Promise<boolean> {
  const doc = await getAntiChannel(chatId);
  const val = !(doc.enabled as boolean);
  await upsert("anti_channel", { _id: chatId }, { enabled: val });
  return val;
}

// ── AntiLinkedChannel ──

export async function getAntiLinked(
  chatId: number,
): Promise<Record<string, unknown>> {
  const doc = await getOne("anti_linked", { _id: chatId });
  return doc || { _id: chatId, enabled: false, anti_pin: false };
}

export async function toggleAntiLinked(chatId: number): Promise<boolean> {
  const doc = await getAntiLinked(chatId);
  const val = !(doc.enabled as boolean);
  await upsert("anti_linked", { _id: chatId }, { enabled: val, anti_pin: doc.anti_pin ?? false });
  return val;
}

export async function toggleAntiPin(chatId: number): Promise<boolean> {
  const doc = await getAntiLinked(chatId);
  const val = !(doc.anti_pin as boolean);
  await upsert("anti_linked", { _id: chatId }, { enabled: doc.enabled ?? false, anti_pin: val });
  return val;
}

// ── WarnFilter ──

export async function getWarnFilters(
  chatId: number,
): Promise<Record<string, unknown>[]> {
  return await getAll("warn_filters", { chat_id: chatId });
}

export async function addWarnFilter(
  chatId: number,
  keyword: string,
): Promise<void> {
  const exists = await getOne("warn_filters", {
    chat_id: chatId,
    keyword,
  });
  if (!exists) {
    await _db()
      .collection("warn_filters")
      .insertOne({ chat_id: chatId, keyword });
  }
}

export async function removeWarnFilter(
  chatId: number,
  keyword: string,
): Promise<void> {
  await deleteOne("warn_filters", { chat_id: chatId, keyword });
}

// ── Warn ──

export async function getWarns(
  userId: number,
  chatId: number,
): Promise<Record<string, unknown>[]> {
  return await getAll("warns", { user_id: userId, chat_id: chatId });
}

export async function addWarn(
  userId: number,
  chatId: number,
  reason: string | null = null,
  warnedBy: number | null = null,
): Promise<void> {
  await _db().collection("warns").insertOne({
    user_id: userId,
    chat_id: chatId,
    reason,
    warned_by: warnedBy,
    warned_at: _ts(),
  });
}

export async function resetWarns(
  userId: number,
  chatId: number,
): Promise<void> {
  await deleteMany("warns", { user_id: userId, chat_id: chatId });
}

// ── Federation ──

export async function getFederation(
  fedId: string,
): Promise<Record<string, unknown> | null> {
  return await getOne("federations", { _id: fedId });
}

export async function createFederation(
  fedId: string,
  name: string,
  owner: number,
  rules: string | null = null,
): Promise<void> {
  await (_db().collection("federations") as any).insertOne({
    _id: fedId,
    name,
    owner,
    rules,
    log_channel: null,
    created_at: _ts(),
  });
}

export async function listFederations(
  query: Record<string, unknown> = {},
): Promise<Record<string, unknown>[]> {
  return await getAll("federations", query);
}

export async function deleteFederation(fedId: string): Promise<void> {
  await deleteOne("federations", { _id: fedId });
}

export async function getFedBans(
  fedId: string,
): Promise<Record<string, unknown>[]> {
  return await getAll("fed_bans", { fed_id: fedId });
}

export async function addFedBan(
  fedId: string,
  userId: number,
  kw: Record<string, unknown> = {},
): Promise<void> {
  const exists = await getOne("fed_bans", { fed_id: fedId, user_id: userId });
  if (!exists) {
    await _db().collection("fed_bans").insertOne({
      fed_id: fedId,
      user_id: userId,
      first_name: kw.first_name,
      last_name: kw.last_name,
      username: kw.username,
      reason: kw.reason,
      banned_at: _ts(),
    });
  }
}

export async function removeFedBan(
  fedId: string,
  userId: number,
): Promise<void> {
  await deleteOne("fed_bans", { fed_id: fedId, user_id: userId });
}

export async function getChatFederation(
  chatId: number,
): Promise<Record<string, unknown> | null> {
  return await getOne("chat_federations", { _id: chatId });
}

export async function setChatFederation(
  chatId: number,
  fedId: string,
  chatName: string | null = null,
): Promise<void> {
  await upsert("chat_federations", { _id: chatId }, { fed_id: fedId, chat_name: chatName });
}

export async function removeChatFederation(chatId: number): Promise<void> {
  await deleteOne("chat_federations", { _id: chatId });
}

// ── GlobalBan ──

export async function getGban(
  userId: number,
): Promise<Record<string, unknown> | null> {
  return await getOne("global_bans", { _id: userId });
}

export async function gbanUser(
  userId: number,
  name: string | null = null,
  reason: string | null = null,
): Promise<void> {
  await upsert("global_bans", { _id: userId }, { name, reason, banned_at: _ts() });
}

export async function ungbanUser(userId: number): Promise<void> {
  await deleteOne("global_bans", { _id: userId });
}

export async function getGbanSettings(
  chatId: number,
): Promise<Record<string, unknown>> {
  const doc = await getOne("gban_settings", { _id: chatId });
  return doc || { _id: chatId, enabled: true };
}

export async function setGbanSetting(
  chatId: number,
  enabled: boolean,
): Promise<void> {
  await upsert("gban_settings", { _id: chatId }, { enabled });
}

// ── AFK ──

export async function getAfk(
  userId: number,
): Promise<Record<string, unknown> | null> {
  return await getOne("afk_users", { _id: userId });
}

export async function setAfk(
  userId: number,
  reason: string | null = null,
): Promise<void> {
  await upsert("afk_users", { _id: userId }, { is_afk: true, reason, since: _ts() });
}

export async function unsetAfk(userId: number): Promise<void> {
  await deleteOne("afk_users", { _id: userId });
}

// ── CleanBlue ──

export async function getCleanBlue(
  chatId: number,
): Promise<Record<string, unknown>> {
  const doc = await getOne("clean_blue", { _id: chatId });
  return doc || { _id: chatId, enabled: false };
}

export async function setCleanBlue(
  chatId: number,
  enabled: boolean,
): Promise<void> {
  await upsert("clean_blue", { _id: chatId }, { enabled });
}

export async function getCleanBlueIgnored(
  chatId: number,
): Promise<string[]> {
  const docs = await getAll("clean_blue_ignores", { chat_id: chatId });
  return docs.map((d) => d.command as string);
}

export async function ignoreCleanBlue(
  chatId: number,
  command: string,
): Promise<void> {
  const exists = await getOne("clean_blue_ignores", {
    chat_id: chatId,
    command,
  });
  if (!exists) {
    await _db()
      .collection("clean_blue_ignores")
      .insertOne({ chat_id: chatId, command });
  }
}

export async function unignoreCleanBlue(
  chatId: number,
  command: string,
): Promise<void> {
  await deleteOne("clean_blue_ignores", { chat_id: chatId, command });
}

// ── NationRole ──

export async function getNationRole(
  userId: number,
): Promise<Record<string, unknown> | null> {
  return await getOne("nation_roles", { _id: userId });
}

export async function setNationRole(
  userId: number,
  role: string,
): Promise<void> {
  await upsert("nation_roles", { _id: userId }, { role });
}

export async function removeNationRole(userId: number): Promise<void> {
  await deleteOne("nation_roles", { _id: userId });
}

export async function getAllRoles(): Promise<Record<string, unknown>[]> {
  return await getAll("nation_roles");
}

// ── Connection ──

export async function getConnection(
  userId: number,
): Promise<Record<string, unknown> | null> {
  return await getOne("connections", { _id: userId });
}

export async function setConnection(
  userId: number,
  chatId: number,
): Promise<void> {
  await upsert("connections", { _id: userId }, { chat_id: chatId });
}

export async function removeConnection(userId: number): Promise<void> {
  await deleteOne("connections", { _id: userId });
}

export async function getConnectionHistory(
  userId: number,
): Promise<Record<string, unknown>[]> {
  return await getAll("connection_history", { user_id: userId });
}

export async function addConnectionHistory(
  userId: number,
  chatId: number,
  chatName: string | null = null,
): Promise<void> {
  await _db()
    .collection("connection_history")
    .insertOne({
      user_id: userId,
      chat_id: chatId,
      chat_name: chatName,
      connected_at: _ts(),
    });
}

// ── HunterProfile ──

export async function getProfile(
  userId: number,
): Promise<Record<string, unknown> | null> {
  return await getOne("hunter_profiles", { _id: userId });
}

export async function setProfile(
  userId: number,
  info: string | null = null,
  bio: string | null = null,
): Promise<void> {
  await upsert("hunter_profiles", { _id: userId }, { info, bio });
}

// ── ReportSetting ──

export async function getReportSetting(
  userId: number,
): Promise<Record<string, unknown>> {
  const doc = await getOne("report_settings", { _id: userId });
  return doc || { _id: userId, should_report: true };
}

export async function setReportSetting(
  userId: number,
  shouldReport: boolean,
): Promise<void> {
  await upsert("report_settings", { _id: userId }, { should_report: shouldReport });
}
