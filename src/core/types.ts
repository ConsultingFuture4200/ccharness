/**
 * Core domain types for plugsmith.
 *
 * These mirror the index/data model in PRD §3 (taxonomy), §4.1 (index model),
 * and §7 (SQLite schema). Keep this file dependency-free: it is the shared
 * vocabulary every other module speaks.
 */

/** Trust tier of a marketplace / component (PRD §4.1). */
export type TrustTier = "official" | "partner" | "community";

/**
 * Component category taxonomy (PRD §3). The index of categories is stable and
 * load-bearing: the recommender maps task signals → categories → components,
 * and the conflict checker keys singleton collisions off `singleton`.
 */
export interface Category {
  /** 1-based id matching PRD §3 ordering. */
  id: number;
  key: string;
  label: string;
  /** Having two enabled in a singleton category is a conflict, not a choice (PRD §3, §4.4). */
  singleton: boolean;
  /** Categories whose members are inherently context-costly (e.g. MCP connectors). */
  contextCostly?: boolean;
}

/** The bundled components a plugin/skill ships (PRD §4.1, §7 `components.bundles`). */
export interface ComponentBundles {
  skills: string[];
  commands: string[];
  /** Hook registrations: event + matcher, used by the hook-collision check (PRD §4.4). */
  hooks: Array<{ event: string; matcher?: string }>;
  /** MCP servers contributed — a primary context-cost signal (PRD §4.1). */
  mcpServers: string[];
}

/**
 * One normalized index entry (PRD §4.1, §7 `components`). Every marketplace
 * source is normalized into this single shape.
 */
export interface Component {
  id: string;
  name: string;
  marketplaceId: string;
  trustTier: TrustTier;
  description?: string;
  /** Category keys from the taxonomy (PRD §3). */
  categoryTags: string[];
  bundles: ComponentBundles;
  /**
   * Derived flag: true when the component adds an MCP server or an always-on
   * hook (SessionStart / broad PreToolUse). Refined by allowed-tools/schema
   * size where declared (PRD §4.1).
   */
  contextCostFlag: boolean;
  /**
   * Persistent (always-on) context cost in tokens for a reference model, taken
   * from the local cache's declared schema size. Used to refine the estimate
   * beyond the boolean flag (PRD §4.1 "use declared schema size to refine the
   * estimate"). Undefined when the source declares no per-model token cost.
   */
  contextTokens?: number;
  /** Category keys for which this component is a singleton occupant (PRD §4.4). */
  singletonCategories: string[];
  /**
   * Which agents/harnesses the component targets. Carried now for future
   * cross-agent awareness; NOT acted on in v1 (PRD §4.1, §7).
   */
  compatibility: string[];
  /** Declared allowed-tools, used to refine context-cost where present. */
  allowedTools?: string[];
  version?: string;
  author?: string;
  license?: string;
  lastSynced?: string;
}

/** A configured marketplace source (PRD §4.1, §7 `marketplaces`). */
export interface Marketplace {
  id: string;
  name: string;
  gitUrl: string;
  trustDefault: TrustTier;
  /** Which normalizer adapter ingests this source. */
  kind: "canonical" | "official" | "custom";
  lastSynced?: string;
}

/** Scope an inventory item lives in (PRD §4.2, §7 `inventory`). */
export type Scope = "system" | "project";

/** One installed component discovered by the inventory scanner (PRD §4.2, §7). */
export interface InventoryItem {
  componentRef: string;
  scope: Scope;
  projectPath?: string;
  enabled: boolean;
  sourceFile: string;
  scannedAt: string;
  /** Annotation joined from the index; null when "installed, not in index". */
  resolved?: Pick<
    Component,
    "categoryTags" | "trustTier" | "contextCostFlag" | "description" | "contextTokens"
  > | null;
  /**
   * Which kind of component this ref is, read from the scan shape (PRD §4.2): a
   * skill (bare directory name) or a plugin (`name@marketplace`). Undefined when
   * the scan could not classify it.
   */
  kind?: "skill" | "plugin";
  /**
   * Derived metadata for an item that is NOT in the marketplace index, read from
   * the component's own on-disk definition (PRD §4.2): a skill's SKILL.md
   * frontmatter or a plugin's plugin.json. Lets `status` (CLI + dashboard) label
   * an out-of-index component with a description and inferred categories instead
   * of a bare "not in index". Populated by `reconcile` only when `resolved` is
   * null; never overrides the authoritative index annotation.
   */
  derived?: {
    /** Free-text description from the component's own definition, when present. */
    description?: string;
    /** Taxonomy keys inferred from name + description + tags (may be empty). */
    categoryTags: string[];
    /** Which on-disk definition the metadata was read from. */
    source: "skill-frontmatter" | "plugin-json";
  };
}

/** Recommender action verbs (PRD §4.3). */
export type RecAction = "enable" | "install" | "disable";

/** One line of the LLM proposal / final recommendation (PRD §4.3). */
export interface RecLine {
  action: RecAction;
  componentRef: string;
  /** Prose reason, anchored to a real catalog entry (PRD §4.3 explainability). */
  reason: string;
}

/** Conflict / context-cost annotation severity (PRD §4.4). */
export type AnnotationSeverity = "info" | "warn" | "conflict";

/** A conflict / context-cost finding (PRD §4.4). */
export interface Annotation {
  severity: AnnotationSeverity;
  kind: "singleton" | "hook" | "command" | "context-cost";
  message: string;
  /** Components involved in this finding. */
  componentRefs: string[];
}

/**
 * The validated, grounded recommendation returned by the recommender (PRD §4.3).
 * Every line resolves to a real catalog entry; annotations are facts the model
 * cannot override.
 */
export interface Recommendation {
  task: string;
  lines: RecLine[];
  annotations: Annotation[];
  contextCostSummary: {
    costlyCount: number;
    tightRequested: boolean;
    /** Summed always-on token cost across the costly components, where known (PRD §4.1). */
    tokenBudget?: number;
    note?: string;
  };
  provider: string;
  /** True when this came from rec_cache rather than a fresh model call (PRD §4.8). */
  cached: boolean;
  /** Index version the recommendation was grounded against. */
  indexVersion: string;
}

/** The strict-JSON contract the model provider must return (PRD §4.7). */
export interface ProviderProposal {
  lines: RecLine[];
}

/**
 * How a tool_use in a session transcript was classified (README Roadmap: usage
 * audit). A `plugin` is an MCP/plugin tool (`mcp__<server>__<tool>`), a `skill`
 * is the `Skill` tool keyed by `input.skill`, and a `builtin` is everything else
 * (Bash/Read/Edit/…). Built-ins are tracked informationally; the audit acts on
 * plugins and skills, the components a user actually installs.
 */
export type UsageKind = "plugin" | "skill" | "builtin";

/**
 * One aggregated usage statistic over the operator's session transcripts
 * (README Roadmap: usage/audit surface). Computed by `scanUsage` from
 * `~/.claude/projects/**\/*.jsonl` — distinct (kind, name) keyed, with the raw
 * call count, the number of distinct sessions it appeared in, and the most
 * recent ISO timestamp it was invoked (file mtime fallback when an event
 * carries no timestamp).
 */
export interface UsageStat {
  kind: UsageKind;
  /**
   * Normalized invocation name: an MCP/plugin tool collapses to its server name
   * (leading `plugin_` stripped, `__<tool>` suffix dropped); a skill is its
   * `input.skill`; a builtin is the bare tool name.
   */
  name: string;
  /** Total tool_use blocks seen for this (kind, name). */
  calls: number;
  /** Distinct sessions (by sessionId, file path fallback) it appeared in. */
  sessions: number;
  /** Most recent ISO timestamp it was invoked. */
  lastUsed?: string;
}

/**
 * One actionable usage suggestion (README Roadmap: trim/keep/add). Deterministic
 * and derived purely from the usage scan joined against the installed inventory
 * and the marketplace index — never a model call. `refs` are the component refs
 * (or index ids) the suggestion concerns, so the CLI/dashboard can act on them.
 */
export interface Suggestion {
  kind: "trim" | "keep" | "add" | "better-use";
  title: string;
  detail: string;
  refs: string[];
}

/**
 * A per-installed-component usage row in the audit (README Roadmap). Joins one
 * inventory item to its usage and its index cost, so the report can rank by use,
 * flag never-invoked components, and compute a cost-per-use for the costly ones.
 */
export interface AuditComponentUsage {
  componentRef: string;
  kind: "skill" | "plugin";
  /** Category keys joined from the index (or derived), for category-aware advice. */
  categoryTags: string[];
  calls: number;
  sessions: number;
  lastUsed?: string;
  /** Always-on token cost from the index, when known (PRD §4.1 `contextTokens`). */
  contextTokens?: number;
  /** `contextTokens / calls` when calls > 0 and a token cost is known. */
  costPerUse?: number;
}

/**
 * The full usage/audit report (README Roadmap: usage surface). Per-plugin/skill
 * invocation counts across sessions, installed-but-unused detection, and the
 * deterministic trim/keep/add/better-use suggestions — the narrative the
 * operator sees rendered by `plugsmith usage`. Built entirely from local data
 * (transcripts + store), no network and no model call.
 */
export interface AuditReport {
  /** Inclusive window the scan covered, in days; undefined = all history. */
  windowDays?: number;
  /** Top plugin invocations across all sessions, calls-descending. */
  topPlugins: UsageStat[];
  /** Top skill invocations across all sessions, calls-descending. */
  topSkills: UsageStat[];
  /** Top built-in tool invocations — informational only, calls-descending. */
  topBuiltins: UsageStat[];
  /** Per-installed-component usage join, calls-descending. */
  installed: AuditComponentUsage[];
  /** Installed components with zero invocations in the window. */
  unused: AuditComponentUsage[];
  /** The operator's most-used categories, derived from used components. */
  activeCategories: string[];
  /** Deterministic trim/keep/add/better-use suggestions. */
  suggestions: Suggestion[];
}
