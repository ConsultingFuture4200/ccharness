/**
 * `@ccharness/core` public surface (PRD §6).
 *
 * Pure functions over a local store where possible. No UI assumptions. The CLI
 * and the read-only dashboard both consume ONLY what is exported here — the UI
 * computes nothing the CLI cannot (PRD §4.6 architectural rule).
 */
export * from "./types.js";
export { TAXONOMY, categoryById, categoryByKey, singletonKeys } from "./taxonomy.js";
export {
  type CcharnessConfig,
  type ProviderName,
  DEFAULT_CONFIG,
  loadConfig,
  configDir,
} from "./config.js";
export { openStore, defaultDbPath, indexVersion, getMeta, setMeta, type DB } from "./db/store.js";

// Registry (Milestone A)
export { sync, search, type SyncReport } from "./registry/sync.js";
export { deriveContextCost, normalizeCanonical, normalizeOfficial } from "./registry/normalizer.js";

// Inventory (Milestone B)
export { scanInventory, reconcile, type ScanReport } from "./inventory/scanner.js";

// Recommender (Milestone C) — the product
export { recommend, annotateStack, prefilter, validateProposal } from "./recommender/index.js";
export { type ModelProvider, PROPOSAL_SCHEMA } from "./recommender/provider.js";

// CLAUDE.md managed block (Milestone D)
export { renderBlock, upsertBlock, writeBlockToFile, startDelimiter } from "./claudemd/block.js";
