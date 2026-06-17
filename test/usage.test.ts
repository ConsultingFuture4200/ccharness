import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { upsertComponents } from "../src/core/db/components.js";
import { type DB, openStore } from "../src/core/db/store.js";
import type { Component, InventoryItem } from "../src/core/types.js";
import { buildAudit } from "../src/core/usage/audit.js";
import { classifyToolUse, scanUsage } from "../src/core/usage/transcripts.js";

/**
 * Hermetic usage/audit tests (README Roadmap: usage surface, PRD §8 posture).
 * A temp transcripts dir stands in for `~/.claude/projects`; an in-memory store
 * stands in for the index + inventory. Nothing here reads the operator's
 * machine.
 */

/** One assistant tool_use event line as Claude Code writes it. */
function toolUseLine(
  sessionId: string,
  timestamp: string,
  name: string,
  input: Record<string, unknown> = {},
): string {
  return JSON.stringify({
    sessionId,
    timestamp,
    message: { role: "assistant", content: [{ type: "tool_use", name, input }] },
  });
}

describe("classifyToolUse (README Roadmap naming)", () => {
  it("maps an MCP tool to a plugin keyed by its server, stripping plugin_ and __tool", () => {
    expect(classifyToolUse("mcp__linear-staqs__list_issues", {})).toEqual({
      kind: "plugin",
      name: "linear-staqs",
    });
    expect(classifyToolUse("mcp__plugin_context-mode_context-mode__ctx_search", {})).toEqual({
      kind: "plugin",
      name: "context-mode_context-mode",
    });
  });

  it("maps the Skill tool to a skill keyed by input.skill", () => {
    expect(classifyToolUse("Skill", { skill: "gsd-quick" })).toEqual({
      kind: "skill",
      name: "gsd-quick",
    });
    expect(classifyToolUse("Skill", {})).toBeUndefined();
  });

  it("maps everything else to a builtin", () => {
    expect(classifyToolUse("Bash", {})).toEqual({ kind: "builtin", name: "Bash" });
  });
});

describe("scanUsage (README Roadmap: transcript scan)", () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "plugsmith-usage-"));
  });
  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("aggregates calls, distinct sessions, lastUsed and classification across files", async () => {
    // Session A: an MCP plugin call (twice) + a Skill + a Bash builtin.
    writeFileSync(
      join(root, "a.jsonl"),
      [
        toolUseLine("sess-a", "2026-06-01T10:00:00.000Z", "mcp__linear-staqs__list_issues"),
        toolUseLine("sess-a", "2026-06-01T10:05:00.000Z", "mcp__linear-staqs__get_issue"),
        toolUseLine("sess-a", "2026-06-01T10:06:00.000Z", "Skill", { skill: "gsd-quick" }),
        toolUseLine("sess-a", "2026-06-01T10:07:00.000Z", "Bash"),
        "{ not json", // malformed line — must be skipped, not fatal.
      ].join("\n"),
    );
    // Session B: the same plugin again (distinct session) + a second builtin.
    writeFileSync(
      join(root, "b.jsonl"),
      [
        toolUseLine("sess-b", "2026-06-02T09:00:00.000Z", "mcp__linear-staqs__list_issues"),
        toolUseLine("sess-b", "2026-06-02T09:01:00.000Z", "Read"),
      ].join("\n"),
    );

    const { stats, filesScanned, totalCalls } = await scanUsage({ root });

    expect(filesScanned).toBe(2);
    expect(totalCalls).toBe(6); // 3 plugin + 1 skill + 2 builtin; malformed skipped.

    const find = (kind: string, name: string) =>
      stats.find((s) => s.kind === kind && s.name === name);

    const plugin = find("plugin", "linear-staqs");
    expect(plugin?.calls).toBe(3);
    expect(plugin?.sessions).toBe(2); // distinct sessions A and B.
    expect(plugin?.lastUsed).toBe("2026-06-02T09:00:00.000Z");

    expect(find("skill", "gsd-quick")?.calls).toBe(1);
    expect(find("builtin", "Bash")?.calls).toBe(1);
  });

  it("bounds work by sinceDays (old events fall outside the window)", async () => {
    const old = "2000-01-01T00:00:00.000Z";
    const now = new Date().toISOString();
    writeFileSync(
      join(root, "c.jsonl"),
      [
        toolUseLine("sess-c", old, "mcp__blender__get_scene_info"),
        toolUseLine("sess-c", now, "mcp__blender__get_scene_info"),
      ].join("\n"),
    );

    const { stats } = await scanUsage({ root, sinceDays: 30 });
    const blender = stats.find((s) => s.kind === "plugin" && s.name === "blender");
    expect(blender?.calls).toBe(1); // only the recent event survives the window.
  });
});

describe("buildAudit (README Roadmap: trim/keep/add)", () => {
  let db: DB;

  beforeEach(() => {
    db = openStore(":memory:");
    // Seed the parent marketplace row so component FK inserts succeed.
    db.prepare(
      "INSERT OR IGNORE INTO marketplaces (id, name, git_url, trust_default, kind) VALUES (?, ?, ?, ?, ?)",
    ).run("test", "test", "file:none", "official", "custom");
  });
  afterEach(() => {
    db.close();
  });

  /** A minimal but valid index Component. */
  function component(overrides: Partial<Component> & Pick<Component, "id" | "name">): Component {
    return {
      marketplaceId: "test",
      trustTier: "official",
      categoryTags: [],
      bundles: { skills: [], commands: [], hooks: [], mcpServers: [] },
      contextCostFlag: false,
      singletonCategories: [],
      compatibility: [],
      ...overrides,
    };
  }

  /** A minimal reconciled inventory item. */
  function item(componentRef: string, kind: "skill" | "plugin"): InventoryItem {
    return {
      componentRef,
      kind,
      scope: "system",
      enabled: true,
      sourceFile: "test",
      scannedAt: "2026-06-01T00:00:00.000Z",
    };
  }

  it("flags an installed-but-unused skill as TRIM and a heavily-used costly plugin as KEEP", () => {
    upsertComponents(db, [
      // A context-costly plugin the operator leans on hard.
      component({
        id: "linear@umb",
        name: "linear",
        categoryTags: ["integrations"],
        contextCostFlag: true,
        contextTokens: 4000,
        bundles: { skills: [], commands: [], hooks: [], mcpServers: ["linear-staqs"] },
      }),
      // An installed skill that is never invoked.
      component({ id: "dormant-skill", name: "dormant-skill", categoryTags: ["domain"] }),
    ]);

    const inventory: InventoryItem[] = [
      item("linear@umb", "plugin"),
      item("dormant-skill", "skill"),
    ];

    const usage = [
      {
        kind: "plugin" as const,
        name: "linear-staqs",
        calls: 30,
        sessions: 5,
        lastUsed: "2026-06-10T00:00:00.000Z",
      },
    ];

    const audit = buildAudit(db, usage, inventory, { top: 8 });

    // The dormant skill is unused → TRIM.
    expect(audit.unused.map((c) => c.componentRef)).toContain("dormant-skill");
    const trim = audit.suggestions.find((s) => s.kind === "trim");
    expect(trim).toBeDefined();
    expect(trim?.refs).toContain("dormant-skill");

    // The plugin joined its MCP-server usage → 30 calls, costly → KEEP earner.
    const linear = audit.installed.find((c) => c.componentRef === "linear@umb");
    expect(linear?.calls).toBe(30);
    expect(linear?.costPerUse).toBeCloseTo(4000 / 30);
    const keep = audit.suggestions.find((s) => s.kind === "keep" && s.refs.includes("linear@umb"));
    expect(keep).toBeDefined();
    expect(keep?.title).toContain("earning its keep");
  });
});
