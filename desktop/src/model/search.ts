import { TapEvent } from "../types";

// firstBroadcast digs out the first { msgId/msgType } object in a decoded frame
// payload (broadcasts arrive singly or in a push list). Reused by summaries,
// facets and analysis so the shape is understood in exactly one place.
export function firstBroadcast(decoded: unknown): any | null {
  if (Array.isArray(decoded)) return decoded.length ? firstBroadcast(decoded[0]) : null;
  if (decoded && typeof decoded === "object") {
    const o = decoded as any;
    if ("msgId" in o || "msgType" in o) return o;
  }
  return null;
}

// kindLabel surfaces the decoder's own label for non-broadcast payloads
// (clientKey, migrate, roomJoined, echo…).
export function kindLabel(decoded: unknown): string | null {
  if (decoded && typeof decoded === "object" && !Array.isArray(decoded)) {
    const k = (decoded as any).kind;
    if (typeof k === "string") return k;
  }
  return null;
}

// searchText builds the lowercased string a row is matched against by the
// filter box.
export function searchText(e: TapEvent): string {
  const parts: string[] = [e.remote];
  if (e.http) parts.push(e.http.method, e.http.path, String(e.http.status), e.http.note ?? "");
  if (e.udp) {
    if (e.udp.other) parts.push("non-diarkis");
    parts.push(e.udp.dir, e.udp.data?.flag ?? "");
    const f = e.udp.data?.frame;
    if (f) {
      parts.push(`ver${f.ver}`, `cmd${f.cmd}`);
      const bc = firstBroadcast(f.decoded);
      if (bc) parts.push(String(bc.msgId ?? ""), String(bc.msgType ?? ""));
    }
  }
  return parts.join(" ").toLowerCase();
}

// matchRanges returns [start,end) spans of query within text (case-insensitive),
// for highlighting. Empty query or no match yields [].
export function matchRanges(text: string, query: string): Array<[number, number]> {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const hay = text.toLowerCase();
  const out: Array<[number, number]> = [];
  let i = hay.indexOf(q);
  while (i !== -1) {
    out.push([i, i + q.length]);
    i = hay.indexOf(q, i + q.length);
  }
  return out;
}
