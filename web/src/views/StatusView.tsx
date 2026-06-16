import { useEffect, useState } from "react";
import { type InventoryItemDto, type StatusDto, fetchStatus } from "../api.js";
import { Badge } from "./IndexView.js";

/**
 * Status view (PRD §4.6): the visual form of `ccharness status`. Renders the
 * reconciled inventory snapshot grouped by scope, with enabled state and the
 * index annotation. Unreadable settings files surface, never silently dropped
 * (PRD §8). Read-only: no enable/disable control exists.
 */
const SCOPES = ["system", "project"] as const;

export function StatusView(): JSX.Element {
  const [data, setData] = useState<StatusDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchStatus()
      .then((res) => {
        if (!cancelled) setData(res);
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
  }, []);

  if (loading) return <p className="text-sm text-slate-500">loading…</p>;
  if (error) return <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>;
  if (!data) return <p className="text-sm text-slate-500">no data</p>;

  return (
    <section className="space-y-5">
      {SCOPES.map((scope) => {
        const group = data.items.filter((i) => i.scope === scope);
        if (group.length === 0) return null;
        return (
          <div key={scope}>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">{scope} scope</h2>
            <ul className="divide-y divide-slate-100 rounded border border-slate-200 bg-white">
              {group.map((item) => (
                <StatusRow key={`${scope}:${item.componentRef}`} item={item} />
              ))}
            </ul>
          </div>
        );
      })}

      {data.items.length === 0 && (
        <p className="text-sm text-slate-500">no installed components found</p>
      )}

      {data.unreadable.length > 0 && (
        <div className="rounded border border-amber-200 bg-amber-50 p-3">
          <h3 className="text-sm font-semibold text-amber-800">Unreadable settings</h3>
          <ul className="mt-1 space-y-0.5 text-xs text-amber-700">
            {data.unreadable.map((u) => (
              <li key={u.file}>
                {u.file} — {u.reason}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function StatusRow({ item }: { item: InventoryItemDto }): JSX.Element {
  return (
    <li className="flex items-center justify-between px-4 py-2.5">
      <span className="flex items-center gap-2">
        <Badge tone={item.enabled ? "green" : "slate"}>{item.enabled ? "on" : "off"}</Badge>
        <span className="font-medium">{item.componentRef}</span>
      </span>
      <span className="flex items-center gap-2 text-xs text-slate-500">
        {item.resolved == null ? (
          <Badge tone="amber">not in index</Badge>
        ) : (
          <>
            <Badge tone="blue">{item.resolved.trustTier}</Badge>
            <span>{(item.resolved.categoryTags.length > 0 ? item.resolved.categoryTags : ["uncategorized"]).join(", ")}</span>
            {item.resolved.contextCostFlag && <Badge tone="amber">context-costly</Badge>}
          </>
        )}
      </span>
    </li>
  );
}
