import { useState } from "react";
import {
  type AnnotationDto,
  type RecLineDto,
  type RecommendationDto,
  fetchRecommendation,
} from "../api.js";
import { Badge } from "./IndexView.js";

/**
 * Recommendation view (PRD §4.6): a task input that calls the SAME core
 * `recommend()` via the read-only API and renders enable/install/disable with
 * per-line reasons, conflict flags, and the context-cost summary. Output for a
 * given task matches `ccharness recommend "<task>"` exactly (PRD §4.6 exit gate).
 *
 * Acting on the result is a CLI step — this view only renders advice, it changes
 * nothing. Paid providers are declined server-side (PRD §4.8); the resulting
 * 402 message is surfaced plainly.
 */
const ACTION_TONE: Record<RecLineDto["action"], "green" | "blue" | "amber"> = {
  enable: "green",
  install: "blue",
  disable: "amber",
};

const SEVERITY_TONE: Record<AnnotationDto["severity"], "slate" | "amber" | "red"> = {
  info: "slate",
  warn: "amber",
  conflict: "red",
};

export function RecommendView(): JSX.Element {
  const [task, setTask] = useState("");
  const [scope, setScope] = useState<"system" | "project">("system");
  const [tight, setTight] = useState(false);
  const [provider, setProvider] = useState<"" | "anthropic" | "local">("");
  const [rec, setRec] = useState<RecommendationDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function run(): Promise<void> {
    if (!task.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetchRecommendation({
        task,
        scope,
        tight,
        ...(provider ? { provider } : {}),
      });
      setRec(res.recommendation);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
      setRec(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="space-y-4">
      <div className="space-y-3 rounded border border-slate-200 bg-white p-4">
        <textarea
          value={task}
          onChange={(e) => setTask(e.target.value)}
          placeholder="describe what you're working on…"
          rows={3}
          className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
        />
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <label className="flex items-center gap-1">
            scope
            <select
              value={scope}
              onChange={(e) => setScope(e.target.value as "system" | "project")}
              className="rounded border border-slate-300 px-2 py-1"
            >
              <option value="system">system</option>
              <option value="project">project</option>
            </select>
          </label>
          <label className="flex items-center gap-1">
            <input type="checkbox" checked={tight} onChange={(e) => setTight(e.target.checked)} />
            keep context tight
          </label>
          <label className="flex items-center gap-1">
            provider
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value as "" | "anthropic" | "local")}
              className="rounded border border-slate-300 px-2 py-1"
            >
              <option value="">default</option>
              <option value="local">local</option>
              <option value="anthropic">anthropic (CLI only)</option>
            </select>
          </label>
          <button
            type="button"
            onClick={run}
            disabled={loading || !task.trim()}
            className="ml-auto rounded bg-slate-900 px-4 py-1.5 text-sm font-medium text-white disabled:opacity-40"
          >
            {loading ? "recommending…" : "Recommend"}
          </button>
        </div>
      </div>

      {error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {rec && <RecommendationResult rec={rec} />}
    </section>
  );
}

function RecommendationResult({ rec }: { rec: RecommendationDto }): JSX.Element {
  const s = rec.contextCostSummary;
  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-500">
        provider: {rec.provider}
        {rec.cached ? " (cached)" : ""} · index {rec.indexVersion}
      </p>

      <div className="rounded border border-slate-200 bg-white p-4">
        <h2 className="mb-2 text-sm font-semibold text-slate-700">Recommended actions</h2>
        {rec.lines.length === 0 ? (
          <p className="text-sm text-slate-500">no actions recommended.</p>
        ) : (
          <ul className="space-y-2">
            {rec.lines.map((line) => (
              <li key={`${line.action}:${line.componentRef}`} className="text-sm">
                <span className="flex items-center gap-2">
                  <Badge tone={ACTION_TONE[line.action]}>{line.action}</Badge>
                  <span className="font-medium">{line.componentRef}</span>
                </span>
                <p className="ml-1 mt-0.5 text-slate-600">{line.reason}</p>
              </li>
            ))}
          </ul>
        )}
      </div>

      {rec.annotations.length > 0 && (
        <div className="rounded border border-slate-200 bg-white p-4">
          <h2 className="mb-2 text-sm font-semibold text-slate-700">Conflicts &amp; context cost</h2>
          <ul className="space-y-1.5">
            {rec.annotations.map((a) => (
              <li key={`${a.kind}:${a.message}`} className="flex items-start gap-2 text-sm">
                <Badge tone={SEVERITY_TONE[a.severity]}>{a.severity}</Badge>
                <span className="text-slate-600">
                  ({a.kind}) {a.message}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="rounded border border-slate-200 bg-white p-4 text-sm text-slate-600">
        <h2 className="mb-1 text-sm font-semibold text-slate-700">Context-cost summary</h2>
        <p>
          {s.costlyCount} context-costly component(s) in the proposed stack
          {s.tightRequested ? " (tight context requested)" : ""}.
        </p>
        {s.note && <p className="mt-1 text-amber-700">{s.note}</p>}
      </div>
    </div>
  );
}
