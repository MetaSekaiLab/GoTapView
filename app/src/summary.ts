import { TapEvent } from "./types";
import { firstBroadcast, kindLabel, searchText } from "./model/search";

// Re-export so existing importers of ./summary keep working.
export { searchText };

// summarize produces the compact right-hand summary shown on each timeline row.
export function summarize(e: TapEvent): string {
  if (e.http) {
    const h = e.http;
    const status = h.status ? ` → ${h.status}` : "";
    const note = h.note ? `  [${h.note}]` : "";
    return `${h.method} ${trimPath(h.path)}${status}${note}`;
  }
  if (e.udp) {
    const dir = e.udp.dir === "c2s" ? "C→S" : "S→C";
    if (e.udp.other) return `${dir} non-Diarkis UDP (${e.udp.other.bytes}B)`;
    const d = e.udp.data;
    if (!d) return `${dir} ?`;

    // a fragment still waiting for the rest of its set
    if (d.split && !d.split.complete) {
      return `${dir} ${d.flag} split ${d.split.index + 1}/${d.split.count} (${d.split.bytes}B)`;
    }
    if (!d.frame) {
      const raw = d.raw ? ` (${d.raw.length / 2}B)` : "";
      return `${dir} ${d.flag}${raw}`;
    }
    const f = d.frame;
    const asm = d.split?.complete ? ` reassembled ${d.split.count}×` : "";
    let msg = `${dir} ${d.flag}${asm} ver${f.ver} cmd${f.cmd}`;
    const bc = broadcastLabel(f.decoded);
    const kind = kindLabel(f.decoded);
    if (bc) msg += `  ${bc}`;
    else if (kind) msg += `  ${kind}`;
    else if (!f.recognized) msg += "  (raw)";
    return msg;
  }
  return `seq ${e.seq}`;
}

function broadcastLabel(decoded: unknown): string | null {
  const obj = firstBroadcast(decoded);
  if (!obj) return null;
  const t = obj.msgType ?? (obj.msgId !== undefined ? `msg${obj.msgId}` : null);
  return t ? String(t) : null;
}

function trimPath(p: string): string {
  // collapse the long numeric userId so paths line up
  return p.replace(/\/\d{15,}/g, "/{uid}");
}
