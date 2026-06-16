import type { Category } from "./types.js";

/**
 * The component taxonomy (PRD §3). Order matches the PRD's numbered list so a
 * `--category 3` flag resolves predictably. `singleton: true` marks categories
 * where two enabled members is a conflict (memory, context manager).
 */
export const TAXONOMY: Category[] = [
  { id: 1, key: "project-mgmt", label: "Project management / spec-driven", singleton: false },
  { id: 2, key: "context-mgmt", label: "Context management", singleton: true },
  { id: 3, key: "memory", label: "Memory / persistence", singleton: true },
  { id: 4, key: "code-quality", label: "Code quality / guardrails", singleton: false },
  { id: 5, key: "security", label: "Security / supply chain", singleton: false },
  { id: 6, key: "git", label: "Git / VCS workflow", singleton: false },
  { id: 7, key: "code-review", label: "Code review", singleton: false },
  { id: 8, key: "testing", label: "Testing / verification", singleton: false },
  { id: 9, key: "multi-agent", label: "Multi-agent / orchestration", singleton: false },
  { id: 10, key: "observability", label: "Observability / telemetry", singleton: false },
  {
    id: 11,
    key: "integrations",
    label: "Integrations / MCP connectors",
    singleton: false,
    contextCostly: true,
  },
  { id: 12, key: "domain", label: "Domain skills", singleton: false },
  { id: 13, key: "output-styling", label: "Output styling / formatting", singleton: false },
];

const BY_ID = new Map(TAXONOMY.map((c) => [c.id, c]));
const BY_KEY = new Map(TAXONOMY.map((c) => [c.key, c]));

export function categoryById(id: number): Category | undefined {
  return BY_ID.get(id);
}

export function categoryByKey(key: string): Category | undefined {
  return BY_KEY.get(key);
}

/** Keys of categories that are singletons — the conflict checker's seed set. */
export function singletonKeys(): string[] {
  return TAXONOMY.filter((c) => c.singleton).map((c) => c.key);
}
