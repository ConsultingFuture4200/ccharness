import type { CcharnessConfig } from "../config.js";
import type { DB } from "../db/store.js";

/**
 * Registry sync (PRD §4.1, Milestone A).
 *
 * `sync` fetches each configured marketplace (canonical catalog primary),
 * normalizes via the adapters, upserts into `components`, and bumps the index
 * version (which invalidates `rec_cache`, PRD §4.8). Skip-loud: returns
 * per-source parsed/skipped counts; never fails the whole run for one bad entry
 * (PRD §8).
 */
export interface SyncSourceReport {
  marketplace: string;
  parsed: number;
  skipped: number;
  error?: string;
}

export interface SyncReport {
  sources: SyncSourceReport[];
  newIndexVersion: string;
}

/** TODO(Milestone A steps 2-6): fetch → normalize → upsert → bump index version. */
export async function sync(_db: DB, _config: CcharnessConfig): Promise<SyncReport> {
  throw new Error("sync not yet implemented (Milestone A)");
}

/** Query the index (PRD §4.1). TODO(Milestone A step 6): FTS over name/description, --category filter. */
export function search(_db: DB, _query: string, _opts?: { category?: number }) {
  throw new Error("search not yet implemented (Milestone A)");
}
