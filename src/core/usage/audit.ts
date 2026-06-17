import { getAllComponents, getComponent } from "../db/components.js";
import type { DB } from "../db/store.js";
import type {
  AuditComponentUsage,
  AuditReport,
  Component,
  InventoryItem,
  Suggestion,
  UsageStat,
} from "../types.js";

/**
 * Usage audit (README Roadmap: trim/keep/add surface).
 *
 * Joins the raw usage scan (from `scanUsage`) against the installed inventory
 * and the marketplace index to produce the operator-facing report: top
 * plugins/skills, installed-but-unused detection, and deterministic
 * trim/keep/add/better-use suggestions. Pure over its inputs — no network, no
 * model call. The "how to better use / add" advice is computed from real usage
 * facts (counts, costs, the operator's active categories), never invented.
 */

/** How many entries each top-N list carries before truncation. */
const DEFAULT_TOP = 10;
/** A component is "costly" worth flagging when its always-on token cost ≥ this. */
const COSTLY_TOKEN_THRESHOLD = 1000;
/** "Heavily used" floor for the KEEP / earning-its-keep classification. */
const HEAVY_USE_CALLS = 20;
/** "Barely used" ceiling (but > 0) for the BETTER-USE classification. */
const BARELY_USE_CALLS = 3;
/** How many ADD/EXPLORE index suggestions to surface per active category. */
const ADD_PER_CATEGORY = 2;
/** How many active categories drive the ADD/EXPLORE pass. */
const ACTIVE_CATEGORY_DEPTH = 3;

/** Options for {@link buildAudit}. */
export interface BuildAuditOptions {
  /** Length of each top-N list (default {@link DEFAULT_TOP}). */
  top?: number;
  /** Echoed into the report as the window the usage scan covered, in days. */
  windowDays?: number;
}

/**
 * The `<name>` part of a plugin ref `name@marketplace`, lowercased for matching.
 * Skills have a bare ref, so the whole ref is the name.
 */
function refName(componentRef: string): string {
  const at = componentRef.indexOf("@");
  return (at >= 0 ? componentRef.slice(0, at) : componentRef).toLowerCase();
}

/**
 * Whether a usage plugin-name matches an installed plugin ref. Best-effort
 * (README Roadmap): the usage name is an MCP server (e.g. `linear-staqs`,
 * `context-mode_context-mode`), the install ref is `name@marketplace`. We match
 * on the ref's `<name>` part appearing in the server name, or any bundled
 * mcpServer of the resolved index Component matching the server name — server
 * naming (`plugin_<plugin>_<server>`) embeds the plugin name, so substring
 * matching either direction is the pragmatic join.
 */
function pluginUsageMatches(
  usageName: string,
  componentRef: string,
  resolved: Component | undefined,
): boolean {
  const server = usageName.toLowerCase();
  const name = refName(componentRef);
  if (name.length > 0 && (server.includes(name) || name.includes(server))) return true;
  if (resolved) {
    for (const mcp of resolved.bundles.mcpServers) {
      const m = mcp.toLowerCase();
      if (m.length > 0 && (server.includes(m) || m.includes(server))) return true;
    }
  }
  return false;
}

/** Category tags for an inventory item: index annotation first, else derived. */
function categoriesFor(item: InventoryItem, resolved: Component | undefined): string[] {
  if (resolved) return resolved.categoryTags;
  if (item.resolved?.categoryTags) return item.resolved.categoryTags;
  return item.derived?.categoryTags ?? [];
}

/** Index `contextTokens` for an item, from the resolved Component or annotation. */
function tokensFor(resolved: Component | undefined, item: InventoryItem): number | undefined {
  if (resolved?.contextTokens != null) return resolved.contextTokens;
  if (item.resolved?.contextTokens != null) return item.resolved.contextTokens;
  return undefined;
}

/**
 * Join one inventory item to its usage. Skills join by exact name; plugins join
 * best-effort (see {@link pluginUsageMatches}), summing every usage row that
 * matches the ref (a plugin can ship several MCP servers).
 */
function joinUsage(
  item: InventoryItem,
  resolved: Component | undefined,
  pluginUsage: UsageStat[],
  skillByName: Map<string, UsageStat>,
): AuditComponentUsage {
  const kind: "skill" | "plugin" =
    item.kind ?? (item.componentRef.includes("@") ? "plugin" : "skill");

  let calls = 0;
  let sessions = 0;
  let lastUsed: string | undefined;
  const fold = (u: UsageStat | undefined): void => {
    if (!u) return;
    calls += u.calls;
    sessions = Math.max(sessions, u.sessions);
    if (u.lastUsed != null && (lastUsed == null || u.lastUsed > lastUsed)) lastUsed = u.lastUsed;
  };

  if (kind === "skill") {
    fold(skillByName.get(item.componentRef.toLowerCase()));
  } else {
    for (const u of pluginUsage) {
      if (pluginUsageMatches(u.name, item.componentRef, resolved)) fold(u);
    }
  }

  const contextTokens = tokensFor(resolved, item);
  const row: AuditComponentUsage = {
    componentRef: item.componentRef,
    kind,
    categoryTags: categoriesFor(item, resolved),
    calls,
    sessions,
  };
  if (lastUsed != null) row.lastUsed = lastUsed;
  if (contextTokens != null) {
    row.contextTokens = contextTokens;
    if (calls > 0) row.costPerUse = contextTokens / calls;
  }
  return row;
}

/** Top-N of a usage list, already calls-descending from `scanUsage`. */
function topN(stats: UsageStat[], kind: UsageStat["kind"], n: number): UsageStat[] {
  return stats.filter((s) => s.kind === kind).slice(0, n);
}

/**
 * The operator's most-used categories, derived from the categories of installed
 * components they actually invoked (README Roadmap "categories the operator USES
 * most"). Weighted by call volume, ties broken by name for determinism.
 */
function deriveActiveCategories(installed: AuditComponentUsage[]): string[] {
  const weight = new Map<string, number>();
  for (const row of installed) {
    if (row.calls <= 0) continue;
    for (const cat of row.categoryTags) {
      weight.set(cat, (weight.get(cat) ?? 0) + row.calls);
    }
  }
  return Array.from(weight.entries())
    .sort((a, z) => z[1] - a[1] || a[0].localeCompare(z[0]))
    .map(([cat]) => cat);
}

/**
 * Build the deterministic trim/keep/add/better-use suggestions (README Roadmap).
 * Order is stable: TRIM rollup, per-KEEP earners, ADD/EXPLORE per active
 * category, then BETTER-USE.
 */
function buildSuggestions(
  db: DB,
  installed: AuditComponentUsage[],
  unused: AuditComponentUsage[],
  activeCategories: string[],
): Suggestion[] {
  const suggestions: Suggestion[] = [];

  // TRIM: installed but never invoked in the window — costly ones first.
  if (unused.length > 0) {
    const installedSkills = installed.filter((c) => c.kind === "skill").length;
    const unusedSkills = unused.filter((c) => c.kind === "skill");
    const costlyUnused = unused
      .filter((c) => (c.contextTokens ?? 0) >= COSTLY_TOKEN_THRESHOLD)
      .sort((a, z) => (z.contextTokens ?? 0) - (a.contextTokens ?? 0));
    const lead =
      installedSkills > 0 && unusedSkills.length > 0
        ? `${unusedSkills.length} of ${installedSkills} installed skills never invoked`
        : `${unused.length} installed component(s) never invoked`;
    const detailParts = [lead];
    if (costlyUnused.length > 0) {
      const names = costlyUnused.slice(0, 5).map((c) => c.componentRef);
      detailParts.push(`context-costly & idle: ${names.join(", ")}`);
    } else {
      detailParts.push(
        `e.g. ${unused
          .slice(0, 5)
          .map((c) => c.componentRef)
          .join(", ")}`,
      );
    }
    suggestions.push({
      kind: "trim",
      title: "Trim unused components",
      detail: detailParts.join(" — "),
      refs: unused.map((c) => c.componentRef),
    });
  }

  // KEEP: heavily-used components; flag the costly-but-heavily-used as earners.
  for (const row of installed) {
    if (row.calls < HEAVY_USE_CALLS) continue;
    const costly = (row.contextTokens ?? 0) >= COSTLY_TOKEN_THRESHOLD;
    const cpu = row.costPerUse != null ? `, ~${Math.round(row.costPerUse)} tok/use` : "";
    suggestions.push({
      kind: "keep",
      title: costly ? `Keep ${row.componentRef} — earning its keep` : `Keep ${row.componentRef}`,
      detail: costly
        ? `${row.calls} calls across ${row.sessions} session(s); context-costly but heavily used${cpu}.`
        : `${row.calls} calls across ${row.sessions} session(s)${cpu}.`,
      refs: [row.componentRef],
    });
  }

  // ADD / EXPLORE: from the index, high-trust components in the operator's most
  // active categories that are NOT installed.
  const installedNames = new Set(installed.map((c) => refName(c.componentRef)));
  const trustRank: Record<string, number> = { official: 0, partner: 1, community: 2 };
  const all = getAllComponents(db);
  for (const cat of activeCategories.slice(0, ACTIVE_CATEGORY_DEPTH)) {
    const candidates = all
      .filter((c) => c.categoryTags.includes(cat) && !installedNames.has(c.name.toLowerCase()))
      .sort(
        (a, z) =>
          (trustRank[a.trustTier] ?? 9) - (trustRank[z.trustTier] ?? 9) ||
          a.name.localeCompare(z.name),
      )
      .slice(0, ADD_PER_CATEGORY);
    for (const c of candidates) {
      suggestions.push({
        kind: "add",
        title: `Explore ${c.name} for ${cat}`,
        detail: `You lean on ${cat}; consider ${c.name} [${c.trustTier}] — not installed.`,
        refs: [c.id],
      });
    }
  }

  // BETTER-USE: installed but barely used (0 < calls ≤ floor) AND relevant to an
  // active category — likely under-leveraged rather than dead weight.
  const active = new Set(activeCategories);
  for (const row of installed) {
    if (row.calls <= 0 || row.calls > BARELY_USE_CALLS) continue;
    const match = row.categoryTags.find((c) => active.has(c));
    if (!match) continue;
    suggestions.push({
      kind: "better-use",
      title: `Make more of ${row.componentRef}`,
      detail: `Installed but barely used (${row.calls} call(s)); relevant to your ${match} work.`,
      refs: [row.componentRef],
    });
  }

  return suggestions;
}

/**
 * Build the full usage/audit report (README Roadmap: usage surface) from a usage
 * scan, the installed inventory, and the index `db`. Pure and deterministic.
 *
 * The `inventory` is the reconciled snapshot (so `resolved`/`derived`/`kind` are
 * populated); usage is the calls-descending output of `scanUsage`.
 */
export function buildAudit(
  db: DB,
  usage: UsageStat[],
  inventory: InventoryItem[],
  opts: BuildAuditOptions = {},
): AuditReport {
  const top = opts.top ?? DEFAULT_TOP;

  const pluginUsage = usage.filter((u) => u.kind === "plugin");
  const skillByName = new Map<string, UsageStat>();
  for (const u of usage) {
    if (u.kind === "skill") skillByName.set(u.name.toLowerCase(), u);
  }

  // One row per distinct installed component ref (dedupe across scopes).
  const seen = new Set<string>();
  const installed: AuditComponentUsage[] = [];
  for (const item of inventory) {
    if (seen.has(item.componentRef)) continue;
    seen.add(item.componentRef);
    const resolved = getComponent(db, item.componentRef);
    installed.push(joinUsage(item, resolved, pluginUsage, skillByName));
  }
  installed.sort((a, z) => z.calls - a.calls || a.componentRef.localeCompare(z.componentRef));

  const unused = installed.filter((c) => c.calls === 0);
  const activeCategories = deriveActiveCategories(installed);
  const suggestions = buildSuggestions(db, installed, unused, activeCategories);

  const report: AuditReport = {
    topPlugins: topN(usage, "plugin", top),
    topSkills: topN(usage, "skill", top),
    topBuiltins: topN(usage, "builtin", top),
    installed,
    unused,
    activeCategories,
    suggestions,
  };
  if (opts.windowDays != null) report.windowDays = opts.windowDays;
  return report;
}
