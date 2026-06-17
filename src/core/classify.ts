import { TAXONOMY } from "./taxonomy.js";

/**
 * Keyword/signal map: category key → words that, when seen in free text,
 * suggest that category is relevant. Deliberately a hand-seeded map over the
 * taxonomy (PRD §3). It is the single source of truth for two readers:
 *
 * - the recommender pre-filter (PRD §4.3 step 1), which bounds the candidate
 *   set from task prose — it does NOT make the pick, the LLM does that; and
 * - `inferCategories` below (PRD §4.2), which derives category tags for
 *   installed components that are not in the marketplace index, from their own
 *   on-disk definition (a skill's name + description, a plugin's keywords).
 *
 * Cheap to extend as the taxonomy evolves; keeping it here means both readers
 * stay in lock-step.
 */
export const SIGNALS: Record<string, string[]> = {
  "project-mgmt": ["plan", "spec", "prd", "roadmap", "milestone", "requirements", "project", "phase"],
  "context-mgmt": ["context", "token", "prompt", "window", "compaction", "summarize"],
  memory: ["memory", "remember", "persist", "recall", "knowledge", "notes", "vault"],
  "code-quality": ["lint", "format", "quality", "refactor", "clean", "style", "guardrail"],
  security: ["security", "secret", "vulnerability", "supply chain", "audit", "credential", "cve"],
  git: ["git", "commit", "branch", "rebase", "merge", "pull request", "pr", "vcs"],
  "code-review": ["review", "pr review", "code review", "feedback", "critique"],
  testing: ["test", "tdd", "coverage", "vitest", "jest", "pytest", "ci", "verify", "verification"],
  "multi-agent": ["agent", "orchestrate", "orchestration", "multi-agent", "subagent", "pipeline", "swarm"],
  observability: ["observability", "telemetry", "logging", "metrics", "trace", "monitor"],
  integrations: ["mcp", "integration", "connector", "api", "slack", "github", "notion", "jira", "linear", "database", "postgres", "postgresql", "sql", "supabase", "stripe"],
  domain: ["domain", "metrc", "shopify", "cannabis", "ecommerce", "amazon", "formulation"],
  "output-styling": ["format output", "styling", "markdown", "render", "presentation", "report style"],
};

/**
 * Infer taxonomy category keys from free text (PRD §4.2). Used to classify
 * installed components that are not in the marketplace index, from their own
 * definition (a skill's name + description, a plugin's name + keywords).
 *
 * Case-insensitive word/substring match against the shared `SIGNALS` map; the
 * returned keys are de-duped and always real taxonomy keys (unknown signals are
 * impossible — the map is keyed by the taxonomy, and we never invent a key).
 * Returns `[]` when nothing matches; the caller renders that as genuinely
 * unclassifiable rather than guessing.
 */
export function inferCategories(text: string): string[] {
  const lower = text.toLowerCase();
  const keys: string[] = [];
  for (const cat of TAXONOMY) {
    const words = SIGNALS[cat.key] ?? [];
    if (words.some((w) => lower.includes(w))) keys.push(cat.key);
  }
  return keys;
}
