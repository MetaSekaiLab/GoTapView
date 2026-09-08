import { TapEvent } from "./types";

// oneLine produces the compact right-hand summary shown on each timeline row.
export function summarize(e: TapEvent): string {
  if (e.http) {
    const h = e.http;
    const status = h.status ? ` → ${h.status}` : "";
    const note = h.note ? `  [${h.note}]` : "";
    return `${h.method} ${trimPath(h.path)}${status}${note}`;
  }
  if (e.udp) {
    const d = e.udp.data;
    const dir = e.udp.dir === "c2s" ? "C→S" : "S→C";
    if (!d.frame) {
      const raw = d.raw ? ` (${d.raw.length / 2}B)` : "";
      return `${dir} ${d.flag}${raw}`;
    }
    const f = d.frame;
    let msg = `${dir} ${d.flag} ver${f.ver} cmd${f.cmd}`;
    const bc = broadcastLabel(f.decoded);
    if (bc) msg += `  ${bc}`;
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

function firstBroadcast(decoded: unknown): any | null {
  if (Array.isArray(decoded)) return decoded.length ? firstBroadcast(decoded[0]) : null;
  if (decoded && typeof decoded === "object") {
    const o = decoded as any;
    if ("msgId" in o || "msgType" in o) return o;
  }
  return null;
}

function trimPath(p: string): string {
  // collapse the long numeric userId so paths line up
  return p.replace(/\/\d{15,}/g, "/{uid}");
}

// searchText builds the string a row is matched against by the filter box.
export function searchText(e: TapEvent): string {
  const parts: string[] = [e.remote];
  if (e.http) parts.push(e.http.method, e.http.path, String(e.http.status), e.http.note ?? "");
  if (e.udp) {
    parts.push(e.udp.dir, e.udp.data.flag);
    const f = e.udp.data.frame;
    if (f) {
      parts.push(`ver${f.ver}`, `cmd${f.cmd}`);
      const bc = firstBroadcast(f.decoded);
      if (bc) parts.push(String(bc.msgId ?? ""), String(bc.msgType ?? ""));
    }
  }
  return parts.join(" ").toLowerCase();
}
