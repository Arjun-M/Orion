import { MongoClient, Db } from "mongodb";
import { config } from "../config.js";

let _client: MongoClient | null = null;
let _db: Db | null = null;

export async function initDb(): Promise<void> {
  _client = new MongoClient(config.mongoUri, {
    tlsAllowInvalidCertificates: true,
  });
  await _client.connect();
  _db = _client.db();
  await _db.command({ ping: 1 });
  console.log("MongoDB primed.");
}

export async function closeDb(): Promise<void> {
  if (_client) {
    await _client.close();
    _client = null;
    _db = null;
  }
  console.log("MongoDB connection closed.");
}

export function getDb(): Db | null {
  return _db;
}
