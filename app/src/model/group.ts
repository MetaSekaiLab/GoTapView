import { Flow, Session, TapEvent } from "../types";
import { assignPhases, PHASE_LABEL } from "./phase";

export type GroupMode = "none" | "flow" | "phase";

export interface Section {
  key: string;
  title: string;
  subtitle?: string;
  data: TapEvent[];
}

// groupEvents turns the (already filtered) events into SectionList sections.
// "none" yields a single unlabelled section so the list host can stay uniform.
export function groupEvents(events: TapEvent[], mode: GroupMode, session: Session | null): Section[] {
  if (mode === "none" || events.length === 0) {
    return [{ key: "all", title: "", data: events }];
  }
  if (mode === "flow") {
    const flows = new Map<number, Flow>();
    session?.flows.forEach((f) => flows.set(f.id, f));
    const order: number[] = [];
    const buckets = new Map<number, TapEvent[]>();
    for (const e of events) {
      if (!buckets.has(e.flowId)) {
        buckets.set(e.flowId, []);
        order.push(e.flowId);
      }
      buckets.get(e.flowId)!.push(e);
    }
    return order.map((id) => {
      const f = flows.get(id);
      const sub = f ? [f.proto, f.mode, f.sni || f.remote].filter(Boolean).join(" · ") : undefined;
      return { key: `flow-${id}`, title: `flow #${id}`, subtitle: sub, data: buckets.get(id)! };
    });
  }
  // phase: group consecutive runs of the same phase
  const phases = assignPhases(events);
  const sections: Section[] = [];
  let cur: Section | null = null;
  let curPhase = "";
  events.forEach((e, i) => {
    const p = phases[i];
    if (!cur || p !== curPhase) {
      cur = { key: `phase-${sections.length}-${p}`, title: PHASE_LABEL[p], data: [] };
      curPhase = p;
      sections.push(cur);
    }
    cur.data.push(e);
  });
  return sections;
}
