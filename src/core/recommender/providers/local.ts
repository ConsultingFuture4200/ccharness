import type { ProviderProposal } from "../../types.js";
import { type ModelProvider, type ProposalInput, ProviderError } from "../provider.js";
import { type FetchLike, SYSTEM_PROMPT, proposeWithRepair } from "./shared.js";

/**
 * Local OpenAI-compatible adapter (PRD §4.7) — the free, private provider (the
 * 3090 rig via an OpenAI-compatible `/chat/completions` endpoint). No key, no
 * cost: the §4.8 cost guard never trips for it (`paid: false`).
 *
 * Same strict-JSON + single-repair-retry + loud-failure discipline as the
 * Anthropic adapter (PRD §4.7). `response_format: {type: "json_object"}` is sent
 * as a hint where the server supports it; parsing remains the real guarantee —
 * a persistent non-conforming response is a LOUD `ProviderError`.
 */
export interface LocalProviderOptions {
  /** OpenAI-compatible base URL, e.g. "http://localhost:8000/v1". */
  baseUrl: string;
  model: string;
  /** Injectable transport — defaults to global fetch. */
  fetchImpl?: FetchLike;
}

interface ChatCompletionResponse {
  choices?: Array<{ message?: { content?: string } }>;
}

/** Pull the assistant message content from the first choice. */
function extractText(body: ChatCompletionResponse): string {
  const content = body.choices?.[0]?.message?.content;
  return typeof content === "string" ? content : "";
}

export function localProvider(cfg: LocalProviderOptions): ModelProvider {
  const fetchImpl = cfg.fetchImpl ?? fetch;
  const baseUrl = cfg.baseUrl.replace(/\/$/, "");

  return {
    name: "local",
    paid: false,
    async propose(input: ProposalInput): Promise<ProviderProposal> {
      const callModel = async (userPrompt: string): Promise<string> => {
        let res: Response;
        try {
          res = await fetchImpl(`${baseUrl}/chat/completions`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              model: cfg.model,
              messages: [
                { role: "system", content: SYSTEM_PROMPT },
                { role: "user", content: userPrompt },
              ],
              response_format: { type: "json_object" },
            }),
          });
        } catch (err) {
          throw new ProviderError(
            `local: request failed — ${err instanceof Error ? err.message : String(err)}`,
          );
        }

        if (!res.ok) {
          const detail = await res.text().catch(() => "");
          throw new ProviderError(
            `local: HTTP ${res.status} ${res.statusText}${detail ? ` — ${detail}` : ""}`,
          );
        }

        const body = (await res.json()) as ChatCompletionResponse;
        return extractText(body);
      };

      return proposeWithRepair("local", callModel, input);
    },
  };
}
