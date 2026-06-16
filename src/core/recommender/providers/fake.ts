import type { ProviderProposal, RecLine } from "../../types.js";
import type { ModelProvider, ProposalInput } from "../provider.js";

/**
 * Deterministic test/dev provider (Milestone C de-risk).
 *
 * Implements the ModelProvider contract (PRD §4.7) without any network call, so
 * the full recommender pipeline (pre-filter → propose → validate → annotate →
 * cache) can be proven end-to-end against a hand-seeded index BEFORE the real
 * Anthropic/local adapters exist. Free (`paid: false`) so the §4.8 cost guard
 * never trips in tests.
 *
 * By default it proposes an `enable`/`install` line for every candidate it is
 * given, PLUS one line referencing a non-existent component — so the grounding
 * layer's hallucination drop (PRD §4.3 step 3) is exercised, not just asserted
 * in theory. The proposal and a call counter are inspectable for cache tests.
 */
export interface FakeProviderOptions {
  /** Override the proposed lines entirely (otherwise derived from candidates). */
  lines?: (input: ProposalInput) => RecLine[];
  /** Inject a hallucinated componentRef (defaults to one that cannot resolve). */
  hallucinatedRef?: string;
}

export class FakeProvider implements ModelProvider {
  readonly name = "fake";
  readonly paid = false;
  /** Number of times propose() actually ran — proves cache hits skip the model. */
  public calls = 0;

  constructor(private readonly opts: FakeProviderOptions = {}) {}

  async propose(input: ProposalInput): Promise<ProviderProposal> {
    this.calls += 1;

    if (this.opts.lines) {
      return { lines: this.opts.lines(input) };
    }

    const installedRefs = new Set(input.inventory.map((i) => i.componentRef));
    const lines: RecLine[] = input.candidates.map((c) => {
      const installed = installedRefs.has(c.id) || installedRefs.has(c.name);
      return {
        action: installed ? "enable" : "install",
        componentRef: c.id,
        reason: `Relevant to the task; ${installed ? "already installed, enable it" : "covers an uncovered need"}.`,
      };
    });

    // One line referencing a component that is NOT in the candidate set — the
    // validator must drop this loudly (PRD §4.3 step 3).
    lines.push({
      action: "install",
      componentRef: this.opts.hallucinatedRef ?? "ghost-plugin-does-not-exist",
      reason: "A plugin the model invented; it does not exist in the index.",
    });

    return { lines };
  }
}
