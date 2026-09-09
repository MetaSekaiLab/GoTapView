import { TapEvent } from "../types";
import { firstBroadcast, searchText } from "./search";

export type KindFilter = "all" | "http" | "udp";

// A facet value with how many events carry it, sorted for stable display.
export interface FacetValue<T> {
  value: T;
  label: string;
  count: number;
}

export interface Facets {
  flows: FacetValue<number>[];
  dirs: FacetValue<"c2s" | "s2c">[];
  cmds: FacetValue<string>[]; // "ver:cmd"
  msgTypes: FacetValue<string>[];
}

// The composable filter state. Empty sets mean "no constraint" for that facet.
export interface FilterState {
  kind: KindFilter;
  text: string;
  flows: Set<number>;
  dirs: Set<string>;
  cmds: Set<string>;
  msgTypes: Set<string>;
}

export const emptyFilter = (): FilterState => ({
  kind: "all",
  text: "",
  flows: new Set(),
  dirs: new Set(),
  cmds: new Set(),
  msgTypes: new Set(),
});

export const cmdKey = (ver: number, cmd: number) => `${ver}:${cmd}`;

export function eventMsgType(e: TapEvent): string | null {
  const bc = firstBroadcast(e.udp?.data?.frame?.decoded);
  if (!bc) return null;
  return String(bc.msgType ?? (bc.msgId !== undefined ? `msg${bc.msgId}` : ""));
}

// extractFacets walks the events once and returns each facet's values with
// counts, sorted (flows/cmds numerically, others by count desc).
export function extractFacets(events: TapEvent[]): Facets {
  const flows = new Map<number, number>();
  const dirs = new Map<"c2s" | "s2c", number>();
  const cmds = new Map<string, number>();
  const msgTypes = new Map<string, number>();
  const bump = <K>(m: Map<K, number>, k: K) => m.set(k, (m.get(k) ?? 0) + 1);

  for (const e of events) {
    bump(flows, e.flowId);
    if (e.udp) {
      bump(dirs, e.udp.dir);
      const f = e.udp.data?.frame;
      if (f) bump(cmds, cmdKey(f.ver, f.cmd));
      const mt = eventMsgType(e);
      if (mt) bump(msgTypes, mt);
    }
  }

  const byNum = (a: FacetValue<number>, b: FacetValue<number>) => a.value - b.value;
  const byCount = <T>(a: FacetValue<T>, b: FacetValue<T>) => b.count - a.count;

  return {
    flows: [...flows].map(([value, count]) => ({ value, count, label: `flow #${value}` })).sort(byNum),
    dirs: [...dirs]
      .map(([value, count]) => ({ value, count, label: value === "c2s" ? "C→S" : "S→C" }))
      .sort(byCount),
    cmds: [...cmds]
      .map(([value, count]) => ({ value, count, label: `ver${value.split(":")[0]} cmd${value.split(":")[1]}` }))
      .sort((a, b) => {
        const [av, ac] = a.value.split(":").map(Number);
        const [bv, bc] = b.value.split(":").map(Number);
        return av - bv || ac - bc;
      }),
    msgTypes: [...msgTypes].map(([value, count]) => ({ value, count, label: value })).sort(byCount),
  };
}

// makePredicate composes the active constraints into one cheap test.
export function makePredicate(f: FilterState): (e: TapEvent) => boolean {
  const q = f.text.trim().toLowerCase();
  return (e: TapEvent) => {
    if (f.kind !== "all" && e.kind !== f.kind) return false;
    if (f.flows.size && !f.flows.has(e.flowId)) return false;
    if (f.dirs.size) {
      if (!e.udp || !f.dirs.has(e.udp.dir)) return false;
    }
    if (f.cmds.size) {
      const fr = e.udp?.data?.frame;
      if (!fr || !f.cmds.has(cmdKey(fr.ver, fr.cmd))) return false;
    }
    if (f.msgTypes.size) {
      const mt = eventMsgType(e);
      if (!mt || !f.msgTypes.has(mt)) return false;
    }
    if (q && !searchText(e).includes(q)) return false;
    return true;
  };
}

export function activeCount(f: FilterState): number {
  return (
    (f.kind !== "all" ? 1 : 0) +
    (f.text.trim() ? 1 : 0) +
    f.flows.size +
    f.dirs.size +
    f.cmds.size +
    f.msgTypes.size
  );
}
