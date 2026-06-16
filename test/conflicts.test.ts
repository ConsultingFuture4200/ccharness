import { describe, expect, it } from "vitest";
import { annotateStack } from "../src/core/recommender/conflicts.js";
import type { Component } from "../src/core/types.js";

function comp(over: Partial<Component> & { id: string; name: string }): Component {
  return {
    marketplaceId: "m",
    trustTier: "community",
    categoryTags: [],
    bundles: { skills: [], commands: [], hooks: [], mcpServers: [] },
    contextCostFlag: false,
    singletonCategories: [],
    compatibility: [],
    ...over,
  };
}

describe("annotateStack", () => {
  it("flags two memory plugins as a conflict (the canonical case, PRD §4.4)", () => {
    const stack = [
      comp({ id: "a", name: "MemoryA", singletonCategories: ["memory"] }),
      comp({ id: "b", name: "MemoryB", singletonCategories: ["memory"] }),
    ];
    const { annotations } = annotateStack(stack);
    const conflict = annotations.find((a) => a.kind === "singleton");
    expect(conflict?.severity).toBe("conflict");
    expect(conflict?.componentRefs.sort()).toEqual(["a", "b"]);
  });

  it("warns on hook collision (same event+matcher)", () => {
    const stack = [
      comp({ id: "a", name: "A", bundles: { skills: [], commands: [], hooks: [{ event: "PreToolUse", matcher: "Bash" }], mcpServers: [] } }),
      comp({ id: "b", name: "B", bundles: { skills: [], commands: [], hooks: [{ event: "PreToolUse", matcher: "Bash" }], mcpServers: [] } }),
    ];
    const { annotations } = annotateStack(stack);
    expect(annotations.some((a) => a.kind === "hook" && a.severity === "warn")).toBe(true);
  });

  it("summarizes context cost and notes tight conflicts", () => {
    const stack = [
      comp({ id: "a", name: "MCP-A", contextCostFlag: true }),
      comp({ id: "b", name: "MCP-B", contextCostFlag: true }),
    ];
    const { annotations, costlyCount } = annotateStack(stack, { tight: true });
    expect(costlyCount).toBe(2);
    const cc = annotations.find((a) => a.kind === "context-cost");
    expect(cc?.severity).toBe("warn");
    expect(cc?.message).toContain("tight");
  });

  it("is clean for a coherent single-occupant stack", () => {
    const stack = [
      comp({ id: "a", name: "Memory", singletonCategories: ["memory"] }),
      comp({ id: "b", name: "Tests", categoryTags: ["testing"] }),
    ];
    const { annotations } = annotateStack(stack);
    expect(annotations.filter((a) => a.severity !== "info")).toHaveLength(0);
  });
});
