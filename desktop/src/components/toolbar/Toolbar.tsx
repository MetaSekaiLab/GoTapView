import { useState } from "react";
import { Facets, FilterState, KindFilter, activeCount } from "../../model/facets";
import { GroupMode } from "../../model/group";
import { FacetSelect } from "./FacetSelect";

// Toolbar owns filtering and grouping: kind tabs, text search, a group-by
// segmented control, and an expandable panel of facet selectors.
export function Toolbar({
  filter,
  setFilter,
  facets,
  counts,
  group,
  setGroup,
}: {
  filter: FilterState;
  setFilter: (f: FilterState) => void;
  facets: Facets;
  counts: { all: number; http: number; udp: number };
  group: GroupMode;
  setGroup: (g: GroupMode) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const active = activeCount(filter);
  const tabs: KindFilter[] = ["all", "http", "udp"];

  const toggle = <T,>(key: keyof FilterState, v: T) => {
    const next = new Set(filter[key] as Set<T>);
    next.has(v) ? next.delete(v) : next.add(v);
    setFilter({ ...filter, [key]: next });
  };

  return (
    <div className="border-b border-border bg-surface">
      <div className="flex items-center gap-2 p-2">
        <div className="flex gap-1">
          {tabs.map((t) => {
            const on = filter.kind === t;
            return (
              <button
                key={t}
                onClick={() => setFilter({ ...filter, kind: t })}
                className={`rounded-md px-2.5 py-[5px] text-xs font-semibold transition-colors ${
                  on ? "bg-accent text-accent-text" : "bg-surface-alt text-dim hover:bg-border"
                }`}
              >
                {t.toUpperCase()} {counts[t]}
              </button>
            );
          })}
        </div>

        <input
          value={filter.text}
          onChange={(e) => setFilter({ ...filter, text: e.target.value })}
          placeholder="filter: path, host, cmd, msgId…"
          spellCheck={false}
          className="min-w-0 flex-1 rounded-md bg-surface-alt px-2.5 py-[7px] text-[13px] text-text placeholder:text-dim"
        />

        <Segmented
          value={group}
          options={[
            ["none", "Flat"],
            ["flow", "Flow"],
            ["phase", "Phase"],
          ]}
          onChange={(g) => setGroup(g as GroupMode)}
        />

        <button
          onClick={() => setExpanded((x) => !x)}
          className={`rounded-md border px-2.5 py-1.5 text-xs font-semibold transition-colors ${
            active ? "border-accent/60 bg-accent/15 text-accent" : "border-border bg-surface-alt text-dim"
          }`}
        >
          {expanded ? "▾" : "▸"} Filters{active ? ` (${active})` : ""}
        </button>
      </div>

      {expanded && (
        <div className="flex flex-col gap-0.5 border-t border-border px-2 pb-2">
          <FacetSelect title="Direction" values={facets.dirs} selected={filter.dirs} onToggle={(v) => toggle("dirs", v)} />
          <FacetSelect title="Flow" values={facets.flows} selected={filter.flows} onToggle={(v) => toggle("flows", v)} />
          <FacetSelect title="Command" values={facets.cmds} selected={filter.cmds} tone="c2s" onToggle={(v) => toggle("cmds", v)} />
          <FacetSelect title="Message" values={facets.msgTypes} selected={filter.msgTypes} tone="accent" onToggle={(v) => toggle("msgTypes", v)} />
          {active > 0 && (
            <button
              onClick={() => setFilter({ kind: "all", text: "", flows: new Set(), dirs: new Set(), cmds: new Set(), msgTypes: new Set() })}
              className="mt-1 self-start text-xs text-accent"
            >
              Clear all filters
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function Segmented({ value, options, onChange }: { value: string; options: Array<[string, string]>; onChange: (v: string) => void }) {
  return (
    <div className="flex overflow-hidden rounded-md border border-border">
      {options.map(([v, label], i) => {
        const on = v === value;
        return (
          <button
            key={v}
            onClick={() => onChange(v)}
            className={`px-2.5 py-1.5 text-xs font-semibold transition-colors ${i ? "border-l border-border" : ""} ${
              on ? "bg-accent text-accent-text" : "bg-surface-alt text-dim hover:bg-border"
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
