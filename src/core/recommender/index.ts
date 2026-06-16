import type { CcharnessConfig } from "../config.js";
import type { DB } from "../db/store.js";
import type { Recommendation } from "../types.js";
import type { ModelProvider } from "./provider.js";

/**
 * Recommender orchestration (PRD §4.3, Milestone C) — the product.
 *
 * Wires the pipeline:
 *   pre-filter (deterministic) → LLM proposal (provider) →
 *   grounding/validation (deterministic) → conflict/context-cost annotation →
 *   cache.
 *
 * The LLM does judgment; the index does truth. The deterministic stages bound
 * the model on both ends.
 */
export interface RecommendOptions {
  scope?: "system" | "project";
  projectPath?: string;
  tight?: boolean;
  integrations?: string[];
  provider?: ModelProvider;
  /** Skip the cache read/write for a forced fresh call (PRD §4.8 `--no-cache`). */
  noCache?: boolean;
}

/**
 * TODO(Milestone C steps 1-6): orchestrate the full pipeline. Cache by
 * (task-signature + index-version + scope); invalidate on sync. Compose the
 * Recommendation from validated lines + annotateStack() output.
 */
export async function recommend(
  _db: DB,
  _config: CcharnessConfig,
  _task: string,
  _opts: RecommendOptions = {},
): Promise<Recommendation> {
  throw new Error("recommend not yet implemented (Milestone C)");
}

export { annotateStack } from "./conflicts.js";
export { prefilter } from "./prefilter.js";
export { validateProposal } from "./validate.js";
