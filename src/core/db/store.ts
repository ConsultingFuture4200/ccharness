import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import Database from "better-sqlite3";
import { SCHEMA_SQL } from "./schema.js";

/** Default store path (PRD §6: `~/.ccharness/ccharness.db`). */
export function defaultDbPath(): string {
  return join(homedir(), ".ccharness", "ccharness.db");
}

export type DB = Database.Database;

/**
 * Open (and create-if-missing) the SQLite store, applying the schema
 * idempotently. Pass `:memory:` for tests.
 */
export function openStore(path: string = defaultDbPath()): DB {
  if (path !== ":memory:") {
    mkdirSync(dirname(path), { recursive: true });
  }
  const db = new Database(path);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(SCHEMA_SQL);
  return db;
}

/** Read a meta value (e.g. the current index version that backs cache keys). */
export function getMeta(db: DB, key: string): string | undefined {
  const row = db.prepare("SELECT value FROM meta WHERE key = ?").get(key) as
    | { value: string }
    | undefined;
  return row?.value;
}

/** Upsert a meta value. */
export function setMeta(db: DB, key: string, value: string): void {
  db.prepare(
    "INSERT INTO meta(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
  ).run(key, value);
}

/** Current index version; defaults to "0" before the first sync. */
export function indexVersion(db: DB): string {
  return getMeta(db, "index_version") ?? "0";
}
