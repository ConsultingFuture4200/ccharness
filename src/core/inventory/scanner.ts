import type { DB } from "../db/store.js";
import type { InventoryItem } from "../types.js";

/**
 * Inventory scanner (PRD §4.2, Milestone B).
 *
 * Scans `~/.claude/plugins/`, `~/.claude/skills/`, project `.claude/`, and the
 * three settings files (`~/.claude/settings.json`, `.claude/settings.json`,
 * `.claude/settings.local.json`) to determine installed + enabled/disabled
 * state and scope. Best-effort: an unparseable settings file is reported and
 * skipped, never fatal (PRD §8).
 */
export interface ScanReport {
  items: InventoryItem[];
  unreadable: Array<{ file: string; reason: string }>;
}

/** TODO(Milestone B step 2): walk dirs + parse settings; read enabled/disabled + scope. */
export function scanInventory(_opts?: { projectPath?: string }): ScanReport {
  throw new Error("scanInventory not yet implemented (Milestone B)");
}

/**
 * Reconcile a scan against the index, annotating each item with
 * category/trust/context-cost; unknown items become "installed, not in index"
 * (PRD §4.2, Milestone B step 3). Persists the snapshot to `inventory`.
 */
export function reconcile(_db: DB, _report: ScanReport): InventoryItem[] {
  throw new Error("reconcile not yet implemented (Milestone B)");
}
