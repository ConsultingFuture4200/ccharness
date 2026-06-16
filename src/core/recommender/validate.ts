import type { Component, ProviderProposal, RecLine } from "../types.js";

/**
 * Grounding / validation — the guardrail (PRD §4.3 step 3, Milestone C step 4).
 *
 * Every proposed component MUST resolve to a real catalog entry in the
 * candidate set; anything that doesn't is dropped LOUDLY as a hallucination.
 * The model proposes only within the deterministic candidate set; it cannot
 * invent the toolchain. Pure and deterministic.
 */
export interface ValidationResult {
  valid: RecLine[];
  /** Lines dropped because the component didn't resolve — surfaced, never hidden. */
  hallucinated: RecLine[];
  /** The validated stack components (for the conflict checker). */
  stack: Component[];
}

export function validateProposal(
  proposal: ProviderProposal,
  candidates: Component[],
): ValidationResult {
  const byRef = new Map<string, Component>();
  for (const c of candidates) {
    byRef.set(c.id, c);
    byRef.set(c.name, c);
  }

  const valid: RecLine[] = [];
  const hallucinated: RecLine[] = [];
  const stack: Component[] = [];

  for (const line of proposal.lines) {
    const resolved = byRef.get(line.componentRef);
    if (!resolved) {
      hallucinated.push(line);
      continue;
    }
    valid.push({ ...line, componentRef: resolved.id });
    // The "stack" for conflict reasoning is what would be ON after acting:
    // enable + install. Disable lines remove from consideration.
    if (line.action !== "disable") stack.push(resolved);
  }

  return { valid, hallucinated, stack };
}
