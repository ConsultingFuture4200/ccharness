import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

/**
 * Real hook-matcher reader (PRD §4.4, Hook-matchers phase).
 *
 * The catalog cache only carries hook *event* names (see
 * `docs/milestone-0-findings.md` §2 — `components.hooks` are bare event strings,
 * matcher-free). The matcher granularity the §4.4 collision check wants lives in
 * the raw per-source hook configs on disk, NOT in any catalog:
 *
 * - settings hooks blocks — `<claudeHome>/settings.json` and project
 *   `.claude/settings.json` + `.claude/settings.local.json` — shape
 *   `{ "<Event>": [ { "matcher": "<pattern>", "hooks": [...] } ] }`.
 * - installed-plugin hook files — resolved via `<claudeHome>/plugins/
 *   installed_plugins.json` (`{ plugins: { "<plugin>@<marketplace>": [ {
 *   installPath } ] } }`) → `<installPath>/hooks/hooks.json`, same
 *   `{ hooks: { "<Event>": [ { matcher?, hooks } ] } }` shape.
 *
 * This reader flattens both into `{ source, event, matcher? }` triples. The
 * plugin source id is the `<plugin>@<marketplace>` ref, which is exactly the
 * index component `id`, so callers can overlay real matchers onto an effective
 * stack's components by id (PRD §4.4 collision keys on event+matcher).
 *
 * Hermetic like `scanInventory`: all base paths are injectable so tests use a
 * temp dir and never read the operator's real `~/.claude`. Best-effort: an
 * unreadable/odd-shaped file yields no entries rather than throwing (PRD §8).
 */
export interface HookRegistration {
  /** Originating source: a settings file id, or a `<plugin>@<marketplace>` ref. */
  source: string;
  /** Lifecycle event name (e.g. `PreToolUse`, `SessionStart`). */
  event: string;
  /**
   * Tool/pattern matcher. Omitted (not empty-string) when the source declares
   * no matcher, so it collapses to event-level in the collision check exactly
   * as a catalog-derived event-only entry does.
   */
  matcher?: string;
}

/** Injectable roots so the read is hermetic in tests (PRD §8). */
export interface HookBasePaths {
  /** System-scope Claude home (default `~/.claude`). */
  claudeHome?: string;
  /** Project root whose `.claude/` settings also contribute (default none). */
  projectPath?: string;
}

/** Read + JSON-parse a file best-effort; any failure yields undefined. */
function readJson(file: string): Record<string, unknown> | undefined {
  if (!existsSync(file)) return undefined;
  try {
    const parsed = JSON.parse(readFileSync(file, "utf8")) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // best-effort: unreadable/malformed → no entries.
  }
  return undefined;
}

/**
 * Flatten a `{ "<Event>": [ { matcher?, hooks } ] }` hooks block into
 * registrations under `source`. A missing/empty/whitespace matcher is dropped so
 * the entry collapses to event-level. Odd-shaped sub-values are skipped.
 */
function flattenHooksBlock(hooks: unknown, source: string, out: HookRegistration[]): void {
  if (!hooks || typeof hooks !== "object" || Array.isArray(hooks)) return;
  for (const [event, entries] of Object.entries(hooks as Record<string, unknown>)) {
    if (!Array.isArray(entries)) continue;
    for (const entry of entries) {
      if (!entry || typeof entry !== "object") continue;
      const matcher = (entry as Record<string, unknown>).matcher;
      const reg: HookRegistration = { source, event };
      if (typeof matcher === "string" && matcher.trim() !== "") reg.matcher = matcher;
      out.push(reg);
    }
  }
}

/** Shape of one install record in `installed_plugins.json`. */
interface InstalledEntry {
  installPath?: unknown;
}

/**
 * Read the `installed_plugins.json` ref → installPath map. Tolerant of the
 * documented array-of-installs shape; the first entry with a string
 * `installPath` wins (a single install per ref on the real machine).
 */
function installedPluginPaths(claudeHome: string): Map<string, string> {
  const out = new Map<string, string>();
  const parsed = readJson(join(claudeHome, "plugins", "installed_plugins.json"));
  const plugins = parsed?.plugins;
  if (!plugins || typeof plugins !== "object" || Array.isArray(plugins)) return out;
  for (const [ref, installs] of Object.entries(plugins as Record<string, unknown>)) {
    if (!Array.isArray(installs)) continue;
    for (const install of installs as InstalledEntry[]) {
      const path = install?.installPath;
      if (typeof path === "string" && path !== "") {
        out.set(ref, path);
        break;
      }
    }
  }
  return out;
}

/**
 * Read all real hook registrations from settings blocks + installed-plugin hook
 * files. The result feeds the conflict check (PRD §4.4) by id.
 */
export function readHookRegistrations(basePaths: HookBasePaths = {}): HookRegistration[] {
  const claudeHome = basePaths.claudeHome ?? join(homedir(), ".claude");
  const out: HookRegistration[] = [];

  // --- Settings hooks blocks ---
  const systemSettings = readJson(join(claudeHome, "settings.json"));
  flattenHooksBlock(systemSettings?.hooks, "settings:system", out);

  if (basePaths.projectPath != null) {
    const projectClaude = join(basePaths.projectPath, ".claude");
    for (const fileName of ["settings.json", "settings.local.json"]) {
      const settings = readJson(join(projectClaude, fileName));
      flattenHooksBlock(settings?.hooks, `settings:project:${fileName}`, out);
    }
  }

  // --- Installed-plugin hook files (source id = the component ref/id) ---
  for (const [ref, installPath] of installedPluginPaths(claudeHome)) {
    const config = readJson(join(installPath, "hooks", "hooks.json"));
    flattenHooksBlock(config?.hooks, ref, out);
  }

  return out;
}

/**
 * Index real plugin hook registrations by their `<plugin>@<marketplace>` source,
 * i.e. by component id. Settings-sourced registrations (whose source is not a
 * component id) are dropped here — the caller overlays matchers onto effective
 * stack components, which are keyed by id. Each component gets its own
 * `{ event, matcher? }` list mirroring `ComponentBundles.hooks`.
 */
export function hooksByComponentId(
  registrations: HookRegistration[],
): Map<string, Array<{ event: string; matcher?: string }>> {
  const out = new Map<string, Array<{ event: string; matcher?: string }>>();
  for (const reg of registrations) {
    if (!reg.source.includes("@")) continue;
    const list = out.get(reg.source) ?? [];
    const hook: { event: string; matcher?: string } = { event: reg.event };
    if (reg.matcher != null) hook.matcher = reg.matcher;
    list.push(hook);
    out.set(reg.source, list);
  }
  return out;
}
