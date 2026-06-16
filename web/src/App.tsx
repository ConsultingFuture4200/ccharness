import { useState } from "react";
import { IndexView } from "./views/IndexView.js";
import { RecommendView } from "./views/RecommendView.js";
import { StatusView } from "./views/StatusView.js";

/**
 * Read-only dashboard shell (PRD §4.6). Three views — Index, Status,
 * Recommendation — over the same `@ccharness/core` data the CLI uses. No view
 * performs a state change; every recommendation on screen is reproducible from
 * `ccharness recommend`.
 */
type Tab = "index" | "status" | "recommend";

const TABS: Array<{ key: Tab; label: string }> = [
  { key: "index", label: "Index" },
  { key: "status", label: "Status" },
  { key: "recommend", label: "Recommendation" },
];

export function App(): JSX.Element {
  const [tab, setTab] = useState<Tab>("index");

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-lg font-semibold">ccharness</h1>
            <p className="text-xs text-slate-500">read-only dashboard — views only, no state changes</p>
          </div>
          <nav className="flex gap-1">
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={`rounded px-3 py-1.5 text-sm font-medium transition ${
                  tab === t.key
                    ? "bg-slate-900 text-white"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {t.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-6">
        {tab === "index" && <IndexView />}
        {tab === "status" && <StatusView />}
        {tab === "recommend" && <RecommendView />}
      </main>
    </div>
  );
}
