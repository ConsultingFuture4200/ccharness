import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { type ComponentDto, fetchIndex } from "../api.js";

/**
 * Index view (PRD §4.6): browse/filter/search the synced component index by
 * category and trust tier, with context-cost flags. The category-distribution
 * chart is the required recharts summary — it renders ONLY counts the API
 * already returned; the UI computes nothing the CLI cannot.
 */
const TRUST_TIERS = ["", "official", "partner", "community"] as const;

export function IndexView(): JSX.Element {
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [trust, setTrust] = useState<string>("");
  const [components, setComponents] = useState<ComponentDto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchIndex(q, category)
      .then((res) => {
        if (!cancelled) setComponents(res.components);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [q, category]);

  // Trust-tier filter is applied client-side over API output (no new logic —
  // just hiding rows the API already returned).
  const visible = useMemo(
    () => (trust ? components.filter((c) => c.trustTier === trust) : components),
    [components, trust],
  );

  const categoryDistribution = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of visible) {
      for (const cat of c.categoryTags.length > 0 ? c.categoryTags : ["uncategorized"]) {
        counts.set(cat, (counts.get(cat) ?? 0) + 1);
      }
    }
    return [...counts.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
  }, [visible]);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="search name / description"
          className="flex-1 rounded border border-slate-300 px-3 py-1.5 text-sm"
        />
        <input
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder="category id or key"
          className="w-48 rounded border border-slate-300 px-3 py-1.5 text-sm"
        />
        <select
          value={trust}
          onChange={(e) => setTrust(e.target.value)}
          className="rounded border border-slate-300 px-3 py-1.5 text-sm"
        >
          {TRUST_TIERS.map((t) => (
            <option key={t || "all"} value={t}>
              {t === "" ? "all tiers" : t}
            </option>
          ))}
        </select>
      </div>

      {error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {categoryDistribution.length > 0 && (
        <div className="rounded border border-slate-200 bg-white p-4">
          <h2 className="mb-2 text-sm font-semibold text-slate-700">Category distribution</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={categoryDistribution} margin={{ left: 0, right: 8, top: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-30} textAnchor="end" height={60} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="count" fill="#0f172a" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <p className="text-xs text-slate-500">
        {loading ? "loading…" : `${visible.length} component(s)`}
      </p>

      <ul className="divide-y divide-slate-100 rounded border border-slate-200 bg-white">
        {visible.map((c) => (
          <li key={c.id} className="px-4 py-3">
            <div className="flex items-center justify-between">
              <span className="font-medium">{c.name}</span>
              <span className="flex items-center gap-2 text-xs">
                <Badge tone={c.trustTier === "official" ? "green" : c.trustTier === "partner" ? "blue" : "slate"}>
                  {c.trustTier}
                </Badge>
                {c.contextCostFlag && <Badge tone="amber">context-costly</Badge>}
              </span>
            </div>
            {c.description && <p className="mt-1 text-sm text-slate-600">{c.description}</p>}
            <p className="mt-1 text-xs text-slate-500">
              {(c.categoryTags.length > 0 ? c.categoryTags : ["uncategorized"]).join(", ")}
              {c.mcpServers > 0 && ` · mcp:${c.mcpServers}`}
              {c.hooks > 0 && ` · hooks:${c.hooks}`}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

type Tone = "green" | "blue" | "slate" | "amber" | "red";

const TONES: Record<Tone, string> = {
  green: "bg-emerald-100 text-emerald-800",
  blue: "bg-sky-100 text-sky-800",
  slate: "bg-slate-100 text-slate-700",
  amber: "bg-amber-100 text-amber-800",
  red: "bg-red-100 text-red-800",
};

export function Badge({ tone, children }: { tone: Tone; children: React.ReactNode }): JSX.Element {
  return <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${TONES[tone]}`}>{children}</span>;
}
