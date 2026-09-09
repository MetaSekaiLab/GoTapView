import { Session, TapEvent } from "../types";
import { firstBroadcast } from "./search";
import { cmdKey } from "./facets";

// Human labels for the (ver,cmd) pairs the capture carries. Anything unlisted
// shows as its raw "verX cmdY".
const CMD_NAME: Record<string, string> = {
  "0:1": "echo",
  "0:2": "migrate",
  "0:4": "clientKey",
  "1:101": "room join",
  "1:102": "member left",
  "1:103": "broadcast",
  "2:3000": "room setup",
  "2:3001": "room sync",
  "2:10000": "time sync",
  "2:10010": "room delta",
  "2:10030": "player delta",
};

export function cmdLabel(ver: number, cmd: number): string {
  return CMD_NAME[cmdKey(ver, cmd)] ?? `ver${ver} cmd${cmd}`;
}

export interface Count {
  key: string;
  label: string;
  count: number;
}

export interface Player {
  uid: string;
  name?: string; // nickname, when a room sync paired it with this uid
}

export interface Overview {
  span: { startMs: number; endMs: number; durationMs: number };
  protocol: { http: number; udpFrames: number; udpControl: number; nonDiarkis: number };
  cmds: Count[];
  msgTypes: Count[];
  keyPoint: { seq: number; relMs: number } | null;
  diarkisKeys: number;
  players: Player[];
  flows: number;
  records: number;
  truncated: boolean;
}

// analyze walks the events once to build the session overview. Pure and cheap;
// callers memoize on session identity.
export function analyze(session: Session): Overview {
  const events = session.events;
  const t0 = session.meta.startedWall;
  let startMs = Infinity;
  let endMs = -Infinity;
  const protocol = { http: 0, udpFrames: 0, udpControl: 0, nonDiarkis: 0 };
  const cmds = new Map<string, number>();
  const msgTypes = new Map<string, number>();
  const uids = new Set<string>(); // every user id seen (broadcast senders + syncs)
  const nameByUid = new Map<string, string>(); // uid -> nickname, from room syncs
  let keyPoint: Overview["keyPoint"] = null;

  const bump = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) ?? 0) + 1);

  for (const e of events) {
    if (e.wallMs < startMs) startMs = e.wallMs;
    if (e.wallMs > endMs) endMs = e.wallMs;

    if (e.http) {
      protocol.http++;
      continue;
    }
    const u = e.udp;
    if (!u) continue;
    if (u.other) {
      protocol.nonDiarkis++;
      continue;
    }
    const f = u.data?.frame;
    if (f) {
      protocol.udpFrames++;
      bump(cmds, cmdKey(f.ver, f.cmd));
      const dec = f.decoded as any;
      if (!keyPoint && dec?.kind === "clientKey") keyPoint = { seq: e.seq, relMs: e.wallMs - t0 };
      const bc = firstBroadcast(f.decoded);
      if (bc) {
        const mt = String(bc.msgType ?? (bc.msgId !== undefined ? `msg${bc.msgId}` : ""));
        if (mt) bump(msgTypes, mt);
        if (bc.sender !== undefined) uids.add(String(bc.sender));
      }
      collectIdentities(f.decoded, uids, nameByUid);
    } else {
      protocol.udpControl++;
    }
  }

  const toCounts = (m: Map<string, number>, lab: (k: string) => string): Count[] =>
    [...m]
      .map(([key, count]) => ({ key, count, label: lab(key) }))
      .sort((a, b) => b.count - a.count);

  return {
    span: {
      startMs: Number.isFinite(startMs) ? startMs : t0,
      endMs: Number.isFinite(endMs) ? endMs : t0,
      durationMs: Number.isFinite(startMs) ? endMs - startMs : 0,
    },
    protocol,
    cmds: toCounts(cmds, (k) => {
      const [v, c] = k.split(":").map(Number);
      return cmdLabel(v, c);
    }),
    msgTypes: toCounts(msgTypes, (k) => k),
    keyPoint,
    diarkisKeys: session.meta.diarkisKeys,
    players: buildPlayers(uids, nameByUid),
    flows: session.meta.flows,
    records: session.meta.records,
    truncated: session.meta.truncated,
  };
}

// buildPlayers turns the collected ids and uid→name map into one entry per
// player, named ones first, then by uid.
function buildPlayers(uids: Set<string>, nameByUid: Map<string, string>): Player[] {
  const all = new Set<string>([...uids, ...nameByUid.keys()]);
  return [...all]
    .map((uid) => ({ uid, name: nameByUid.get(uid) }))
    .sort((a, b) => (a.name ? 0 : 1) - (b.name ? 0 : 1) || a.uid.localeCompare(b.uid));
}

// collectIdentities pairs a UserID with its nickname wherever a room sync places
// them together (the top-level user and each Players[] entry of cmd 3001, and
// any similarly shaped object). This is what lets the Overview show a name
// against a uid instead of listing the two separately.
function collectIdentities(decoded: unknown, uids: Set<string>, nameByUid: Map<string, string>): void {
  const visit = (v: any) => {
    if (!v || typeof v !== "object") return;
    if (!Array.isArray(v)) {
      const uid = v.UserID ?? v.UserId ?? v.userId;
      if (uid !== undefined && uid !== null) {
        const id = String(uid);
        uids.add(id);
        const pp = v.PlayerProperty;
        const nick = pp && pp.Values && pp.Values.nickname;
        const name = nick && typeof nick === "object" ? nick.v : undefined;
        if (typeof name === "string" && name) nameByUid.set(id, name);
      }
      Object.values(v).forEach(visit);
    } else {
      v.forEach(visit);
    }
  };
  visit(decoded);
}
