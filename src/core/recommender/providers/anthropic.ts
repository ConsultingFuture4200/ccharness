import type { ProviderProposal } from "../../types.js";
import { type ModelProvider, type ProposalInput, ProviderError } from "../provider.js";
import { type FetchLike, SYSTEM_PROMPT, proposeWithRepair } from "./shared.js";

/**
 * Anthropic Messages API adapter (PRD §4.7) — the paid, highest-quality
 * provider. Uses native `fetch` against the Messages API; the key is read from
 * the env var named by `cfg.apiKeyEnv` (never inlined, never logged).
 *
 * Strict-JSON discipline (PRD §4.7): the system prompt + a final-answer-only
 * instruction constrain the model to a single JSON object matching
 * PROPOSAL_SCHEMA. Parsing is tolerant of a markdown fence; a non-conforming
 * response triggers exactly one repair retry, after which a persistent miss is a
 * LOUD `ProviderError` — never a silent degraded recommendation.
 */
export interface AnthropicProviderOptions {
  model: string;
  /** Env var holding the API key (e.g. "ANTHROPIC_API_KEY"). */
  apiKeyEnv: string;
  /** Override the API base URL (testing / proxies). */
  baseUrl?: string;
  /** Injectable transport — defaults to global fetch. */
  fetchImpl?: FetchLike;
}

const ANTHROPIC_VERSION = "2023-06-01";
const DEFAULT_BASE_URL = "https://api.anthropic.com";

interface AnthropicTextBlock {
  type: string;
  text?: string;
}

interface AnthropicResponse {
  content?: AnthropicTextBlock[];
}

/** Concatenate the text blocks of a Messages API response into one string. */
function extractText(body: AnthropicResponse): string {
  if (!Array.isArray(body.content)) return "";
  return body.content
    .filter((b) => b.type === "text" && typeof b.text === "string")
    .map((b) => b.text as string)
    .join("");
}

export function anthropicProvider(cfg: AnthropicProviderOptions): ModelProvider {
  const fetchImpl = cfg.fetchImpl ?? fetch;
  const baseUrl = (cfg.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");

  return {
    name: "anthropic",
    paid: true,
    async propose(input: ProposalInput): Promise<ProviderProposal> {
      const apiKey = process.env[cfg.apiKeyEnv];
      if (!apiKey) {
        throw new ProviderError(`anthropic: API key env var ${cfg.apiKeyEnv} is not set`);
      }

      const callModel = async (userPrompt: string): Promise<string> => {
        let res: Response;
        try {
          res = await fetchImpl(`${baseUrl}/v1/messages`, {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "x-api-key": apiKey,
              "anthropic-version": ANTHROPIC_VERSION,
            },
            body: JSON.stringify({
              model: cfg.model,
              max_tokens: 2048,
              system: SYSTEM_PROMPT,
              messages: [{ role: "user", content: userPrompt }],
            }),
          });
        } catch (err) {
          throw new ProviderError(
            `anthropic: request failed — ${err instanceof Error ? err.message : String(err)}`,
          );
        }

        if (!res.ok) {
          const detail = await res.text().catch(() => "");
          throw new ProviderError(
            `anthropic: HTTP ${res.status} ${res.statusText}${detail ? ` — ${detail}` : ""}`,
          );
        }

        const body = (await res.json()) as AnthropicResponse;
        return extractText(body);
      };

      return proposeWithRepair("anthropic", callModel, input);
    },
  };
}
