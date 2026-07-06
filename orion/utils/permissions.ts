import { getAllRoles } from "../database/models.js";
import { cacheGet, cacheSet } from "../database/cache.js";
import type { Api } from "grammy";
import type { ChatMember } from "grammy/types";

interface RoleRecord {
  _id: number;
  role?: string;
}

export let OWNER_IDS: Set<number> = new Set();

export let DEV_USERS: Set<number> = new Set();
export let SUDO_USERS: Set<number> = new Set();
export let SUPPORT_USERS: Set<number> = new Set();
export let HUNTER_USERS: Set<number> = new Set();
export let TRUSTED_USERS: Set<number> = new Set();

const ADMIN_CACHE_TTL = 600;

export async function fetchAndCacheAdmins(
  chatId: number,
  api: Api,
): Promise<ChatMember[]> {
  const admins = await api.getChatAdministrators(chatId);
  const ids = admins.map((a) => a.user.id);
  cacheSet(`admin:${chatId}`, { admins: ids }, ADMIN_CACHE_TTL);
  return admins;
}

export const HIERARCHY: Record<string, number> = {
  dev: 5,
  sudo: 4,
  support: 3,
  hunter: 2,
  trusted: 1,
};

export async function loadRoles(): Promise<void> {
  const rows = (await getAllRoles()) as unknown as RoleRecord[];
  const dev: Set<number> = new Set();
  const sudo: Set<number> = new Set();
  const support: Set<number> = new Set();
  const hunter: Set<number> = new Set();
  const trusted: Set<number> = new Set();

  for (const row of rows) {
    const uid = row._id;
    const role = row.role;
    if (role === "dev") dev.add(uid);
    else if (role === "sudo") sudo.add(uid);
    else if (role === "support") support.add(uid);
    else if (role === "hunter") hunter.add(uid);
    else if (role === "trusted") trusted.add(uid);
  }

  for (const uid of OWNER_IDS) {
    dev.add(uid);
    sudo.add(uid);
  }

  DEV_USERS = dev;
  SUDO_USERS = sudo;
  SUPPORT_USERS = support;
  HUNTER_USERS = hunter;
  TRUSTED_USERS = trusted;
}

export function hasRole(userId: number, minRole: string): boolean {
  const roleLevel = HIERARCHY[minRole] ?? 0;
  for (const [role, level] of Object.entries(HIERARCHY)) {
    if (level >= roleLevel) {
      const roleSet = getRoleSet(role);
      if (roleSet.has(userId)) return true;
    }
  }
  return false;
}

function getRoleSet(role: string): Set<number> {
  const map: Record<string, Set<number>> = {
    dev: DEV_USERS,
    sudo: SUDO_USERS,
    support: SUPPORT_USERS,
    hunter: HUNTER_USERS,
    trusted: TRUSTED_USERS,
  };
  return map[role] ?? new Set();
}

export async function isAdmin(
  chatId: number,
  userId: number,
): Promise<boolean> {
  const key = `admin:${chatId}`;
  const cached = cacheGet(key);
  if (cached !== null) {
    const admins = cached.admins as number[] | undefined;
    return admins ? admins.includes(userId) : false;
  }
  return false;
}

export function requireAdmin(
  handler: (ctx: any) => Promise<void>,
): (ctx: any) => Promise<void> {
  return async (ctx: any) => {
    const userId = ctx.from?.id;
    const chatId = ctx.chat?.id;
    if (userId && chatId && (await isAdmin(chatId, userId))) {
      return handler(ctx);
    }
    const { NOT_ADMIN_TEXTS, pick } = await import("./texts.js");
    await ctx.answerCallbackQuery?.({
      text: pick(NOT_ADMIN_TEXTS),
      show_alert: true,
    });
  };
}

export function requireDev(
  handler: (ctx: any) => Promise<void>,
): (ctx: any) => Promise<void> {
  return async (ctx: any) => {
    const userId = ctx.from?.id;
    if (userId && (DEV_USERS.has(userId) || OWNER_IDS.has(userId))) {
      return handler(ctx);
    }
    const { NOT_DEV_TEXTS, pick } = await import("./texts.js");
    await ctx.answerCallbackQuery?.({
      text: pick(NOT_DEV_TEXTS),
      show_alert: true,
    });
  };
}
