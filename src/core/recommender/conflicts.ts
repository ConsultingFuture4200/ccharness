import type { Annotation, Component } from "../types.js";

/**
 * Conflict + context-cost checker (PRD §4.4) — the differentiator.
 *
 * Runs as hard FACTS over the validated stack: the LLM cannot wave away a
 * two-memory-plugin conflict or hide context cost. Pure and deterministic.
 *
 * - Singleton-category collision (two memory engines / two context managers) → conflict
 * - Hook collision (same event+matcher) → warn
 * - Command-name collision → warn
 * - Context-cost summary → info, with a note when tight was requested
 */
export function annotateStack(
  stack: Component[],
  opts: { tight?: boolean } = {},
): { annotations: Annotation[]; costlyCount: number } {
  const annotations: Annotation[] = [];

  // Singleton-category collisions.
  const bySingleton = new Map<string, Component[]>();
  for (const c of stack) {
    for (const key of c.singletonCategories) {
      const list = bySingleton.get(key) ?? [];
      list.push(c);
      bySingleton.set(key, list);
    }
  }
  for (const [key, comps] of bySingleton) {
    if (comps.length > 1) {
      annotations.push({
        severity: "conflict",
        kind: "singleton",
        message: `Two components occupy singleton category "${key}": ${comps
          .map((c) => c.name)
          .join(", ")}. Pick one.`,
        componentRefs: comps.map((c) => c.id),
      });
    }
  }

  // Hook collisions: same event+matcher across different components.
  const byHook = new Map<string, Component[]>();
  for (const c of stack) {
    for (const h of c.bundles.hooks) {
      const sig = `${h.event}::${h.matcher ?? "*"}`;
      const list = byHook.get(sig) ?? [];
      list.push(c);
      byHook.set(sig, list);
    }
  }
  for (const [sig, comps] of byHook) {
    if (new Set(comps.map((c) => c.id)).size > 1) {
      annotations.push({
        severity: "warn",
        kind: "hook",
        message: `Multiple components register hook ${sig} (ordering/precedence surprise).`,
        componentRefs: [...new Set(comps.map((c) => c.id))],
      });
    }
  }

  // Command-name collisions.
  const byCommand = new Map<string, Component[]>();
  for (const c of stack) {
    for (const cmd of c.bundles.commands) {
      const list = byCommand.get(cmd) ?? [];
      list.push(c);
      byCommand.set(cmd, list);
    }
  }
  for (const [cmd, comps] of byCommand) {
    if (new Set(comps.map((c) => c.id)).size > 1) {
      annotations.push({
        severity: "warn",
        kind: "command",
        message: `Command "${cmd}" exposed by multiple components.`,
        componentRefs: [...new Set(comps.map((c) => c.id))],
      });
    }
  }

  // Context-cost summary.
  const costly = stack.filter((c) => c.contextCostFlag);
  if (costly.length > 0) {
    const note = opts.tight
      ? "Task requested tight context, but the stack is hook-/MCP-heavy."
      : undefined;
    annotations.push({
      severity: opts.tight && costly.length > 1 ? "warn" : "info",
      kind: "context-cost",
      message:
        `${costly.length} context-costly component(s): ${costly.map((c) => c.name).join(", ")}.` +
        (note ? ` ${note}` : ""),
      componentRefs: costly.map((c) => c.id),
    });
  }

  return { annotations, costlyCount: costly.length };
}
