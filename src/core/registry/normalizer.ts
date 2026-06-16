import type { Component, TrustTier } from "../types.js";

/**
 * Normalizer (PRD §4.1, Milestone A step 4).
 *
 * Maps a raw source entry into the single `Component` index model. The
 * canonical `marketplace.extended.json` is the primary, low-risk path (mostly
 * field mapping); a thinner adapter handles the official-marketplace shape.
 *
 * Contract: malformed entries throw `NormalizeError` so the caller can
 * skip-loud and keep per-source parsed/skipped counts (PRD §8).
 */
export class NormalizeError extends Error {}

export interface NormalizeResult {
  parsed: Component[];
  skipped: Array<{ raw: unknown; reason: string }>;
}

/** Derive the context-cost flag (PRD §4.1). MCP server or always-on hook → costly. */
export function deriveContextCost(bundles: Component["bundles"]): boolean {
  if (bundles.mcpServers.length > 0) return true;
  const ALWAYS_ON = new Set(["SessionStart", "UserPromptSubmit"]);
  return bundles.hooks.some((h) => ALWAYS_ON.has(h.event) || (h.event === "PreToolUse" && !h.matcher));
}

/**
 * Canonical-catalog ingester mapping (PRD §4.1, Milestone A step 2).
 * TODO(Milestone A): map enforced frontmatter
 * (name/description/allowed-tools/version/author/license/compatibility/tags)
 * straight into Component. Stub until the catalog field shapes are confirmed in
 * Milestone 0.
 */
export function normalizeCanonical(_raw: unknown, _marketplaceId: string, _trust: TrustTier): NormalizeResult {
  throw new NormalizeError("normalizeCanonical not yet implemented (Milestone A)");
}

/**
 * Official-marketplace adapter (`.claude-plugin/marketplace.json` shape).
 * TODO(Milestone A step 4): thinner adapter; derive trust + context-cost.
 */
export function normalizeOfficial(_raw: unknown, _marketplaceId: string): NormalizeResult {
  throw new NormalizeError("normalizeOfficial not yet implemented (Milestone A)");
}
