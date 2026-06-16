import type { DB } from "../db/store.js";
import type { Component, InventoryItem } from "../types.js";

/**
 * Deterministic pre-filter (PRD §4.3 step 1, Milestone C step 1).
 *
 * From the task prose + flags, narrow the full index to a plausible candidate
 * set (likely categories → real components, preferring already-installed and
 * higher-trust). This keeps the model prompt small and bounded, and bounds what
 * the model is allowed to choose. Breadth is tunable (PRD §12 Q2).
 *
 * This is intentionally deterministic and cheap — NOT the matcher. The LLM does
 * the judgment; this just bounds the choice set.
 */
export interface PrefilterInput {
  task: string;
  inventory: InventoryItem[];
  breadth: "narrow" | "balanced" | "generous";
  integrations?: string[];
}

/**
 * TODO(Milestone C step 1): task → likely category keys (keyword/signal map),
 * categories → components from the index, rank by (installed, trust tier),
 * truncate by breadth. Returns the candidate set the model will see.
 */
export function prefilter(_db: DB, _input: PrefilterInput): Component[] {
  throw new Error("prefilter not yet implemented (Milestone C)");
}
