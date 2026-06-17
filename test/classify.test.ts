import { describe, expect, it } from "vitest";
import { SIGNALS, inferCategories } from "../src/core/classify.js";
import { categoryByKey } from "../src/core/taxonomy.js";

/**
 * Unit tests for category inference (PRD §4.2). `inferCategories` maps free text
 * (a component's own name + description + tags) onto the taxonomy via the shared
 * SIGNALS map — the single source of truth the recommender pre-filter also uses.
 */
describe("inferCategories (PRD §4.2)", () => {
  it("maps representative skill text onto the expected taxonomy keys", () => {
    expect(inferCategories("vault Capture session knowledge into the Obsidian vault")).toContain(
      "memory",
    );
    expect(inferCategories("git-check pre-flight for risky git rebase operations")).toContain("git");
    expect(
      inferCategories("gsd-plan-phase create a detailed phase plan and roadmap milestone"),
    ).toContain("project-mgmt");
    expect(
      inferCategories("review-pr run code review feedback on a pull request"),
    ).toEqual(expect.arrayContaining(["code-review", "git"]));
  });

  it("is case-insensitive and substring-based", () => {
    expect(inferCategories("VITEST COVERAGE")).toContain("testing");
    expect(inferCategories("works with Supabase and Stripe")).toContain("integrations");
  });

  it("returns de-duped, real taxonomy keys only — never invents one", () => {
    const keys = inferCategories("agent orchestration multi-agent subagent pipeline");
    expect(new Set(keys).size).toBe(keys.length);
    for (const k of keys) expect(categoryByKey(k)).toBeDefined();
  });

  it("returns [] for genuinely unclassifiable text", () => {
    expect(inferCategories("xyzzy frobnicate qwerty")).toEqual([]);
    expect(inferCategories("")).toEqual([]);
  });

  it("SIGNALS is keyed only by taxonomy keys", () => {
    for (const key of Object.keys(SIGNALS)) expect(categoryByKey(key)).toBeDefined();
  });
});
