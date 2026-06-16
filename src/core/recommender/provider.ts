import type { Component, InventoryItem, ProviderProposal } from "../types.js";

/**
 * Model provider adapter seam (PRD §4.7).
 *
 * Every provider implements ONE contract: given (task, candidate set,
 * inventory) return a strict-JSON proposal against a fixed schema. Core depends
 * only on this interface, never on which provider answered. Adding a provider
 * (or pointing at a different local endpoint) is a config change, not a core
 * change.
 *
 * Malformed JSON is a LOUD failure (`ProviderError`), never a silent degraded
 * recommendation (PRD §4.7, §4.8).
 */
export class ProviderError extends Error {}

export interface ProposalInput {
  task: string;
  candidates: Component[];
  inventory: InventoryItem[];
  flags: { tight?: boolean; integrations?: string[]; scope?: "system" | "project" };
}

export interface ModelProvider {
  readonly name: string;
  /** Whether calls cost money — drives the §4.8 confirm guard. */
  readonly paid: boolean;
  propose(input: ProposalInput): Promise<ProviderProposal>;
}

/** The JSON schema the model is constrained to return (PRD §4.7). */
export const PROPOSAL_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["lines"],
  properties: {
    lines: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["action", "componentRef", "reason"],
        properties: {
          action: { type: "string", enum: ["enable", "install", "disable"] },
          componentRef: { type: "string" },
          reason: { type: "string" },
        },
      },
    },
  },
} as const;

/** TODO(Milestone C step 2): Anthropic adapter (paid). Strict JSON via tool/response_format. */
export function anthropicProvider(_cfg: { model: string; apiKeyEnv: string }): ModelProvider {
  throw new ProviderError("anthropicProvider not yet implemented (Milestone C)");
}

/** TODO(Milestone C step 2): local OpenAI-compatible adapter (free). The 3090 rig. */
export function localProvider(_cfg: { baseUrl: string; model: string }): ModelProvider {
  throw new ProviderError("localProvider not yet implemented (Milestone C)");
}
