import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG } from "../src/core/config.js";
import { selectProvider } from "../src/core/recommender/factory.js";
import { ProviderError } from "../src/core/recommender/provider.js";

/** Provider selection (PRD §4.7): flag wins, else config default; absent config is loud. */
describe("selectProvider (PRD §4.7)", () => {
  it("defaults to config.defaultProvider when no override is given", () => {
    expect(selectProvider(DEFAULT_CONFIG).name).toBe(DEFAULT_CONFIG.defaultProvider);
  });

  it("honors an explicit --provider override", () => {
    expect(selectProvider(DEFAULT_CONFIG, "anthropic").name).toBe("anthropic");
    expect(selectProvider(DEFAULT_CONFIG, "local").name).toBe("local");
  });

  it("marks anthropic paid and local free", () => {
    expect(selectProvider(DEFAULT_CONFIG, "anthropic").paid).toBe(true);
    expect(selectProvider(DEFAULT_CONFIG, "local").paid).toBe(false);
  });

  it("throws ProviderError when the requested provider has no config block", () => {
    const noAnthropic = { ...DEFAULT_CONFIG, anthropic: undefined };
    expect(() => selectProvider(noAnthropic, "anthropic")).toThrow(ProviderError);
  });
});
