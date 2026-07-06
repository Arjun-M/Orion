import Database from "better-sqlite3";
import { config } from "../config.js";

let _db: Database.Database | null = null;

function getDb(): Database.Database {
  if (!_db) {
    _db = new Database(config.cachePath);
    _db.exec(
      "CREATE TABLE IF NOT EXISTS cache (key TEXT PRIMARY KEY, value TEXT, expires_at REAL)",
    );
    _db.exec(
      "CREATE TABLE IF NOT EXISTS rate_limit (user_id INTEGER, window_start REAL, count INTEGER, PRIMARY KEY (user_id, window_start))",
    );
  }
  return _db;
}

export function cacheGet(key: string): Record<string, unknown> | null {
  const conn = getDb();
  const row = conn
    .prepare("SELECT value, expires_at FROM cache WHERE key = ?")
    .get(key) as { value: string; expires_at: number } | undefined;
  if (row) {
    if (Date.now() / 1000 < row.expires_at) {
      return JSON.parse(row.value) as Record<string, unknown>;
    }
    conn.prepare("DELETE FROM cache WHERE key = ?").run(key);
  }
  return null;
}

export function cacheSet(
  key: string,
  value: Record<string, unknown>,
  ttl: number = 60,
): void {
  const conn = getDb();
  conn
    .prepare(
      "INSERT OR REPLACE INTO cache (key, value, expires_at) VALUES (?, ?, ?)",
    )
    .run(key, JSON.stringify(value), Date.now() / 1000 + ttl);
}

export function cacheDelete(key: string): void {
  const conn = getDb();
  conn.prepare("DELETE FROM cache WHERE key = ?").run(key);
}

export function cacheClear(): void {
  const conn = getDb();
  conn.exec("DELETE FROM cache");
  conn.exec("DELETE FROM rate_limit");
}

export function rateLimitCheck(
  userId: number,
  maxCount: number = 20,
  window: number = 60,
): boolean {
  const conn = getDb();
  const now = Date.now() / 1000;
  const cutoff = now - window;

  conn.prepare("DELETE FROM rate_limit WHERE window_start < ?").run(cutoff);

  const row = conn
    .prepare(
      "SELECT count FROM rate_limit WHERE user_id = ? AND window_start > ?",
    )
    .get(userId, cutoff) as { count: number } | undefined;

  if (row && row.count >= maxCount) {
    return false;
  }

  if (row) {
    conn
      .prepare(
        "UPDATE rate_limit SET count = count + 1 WHERE user_id = ? AND window_start > ?",
      )
      .run(userId, cutoff);
  } else {
    conn
      .prepare(
        "INSERT INTO rate_limit (user_id, window_start, count) VALUES (?, ?, 1)",
      )
      .run(userId, now);
  }

  return true;
}
